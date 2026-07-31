import React, { useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, BrainCircuit, CheckCircle2, FileText, Loader2, Sparkles, TimerReset, Trophy, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { useAIInterview } from '@/hooks/useAIInterview';

const levelMap = {
    junior: 'beginner',
    mid: 'intermediate',
    senior: 'advanced',
};

const prettyLevelMap = {
    junior: 'Junior',
    mid: 'Mid-Level',
    senior: 'Senior',
    beginner: 'Beginner',
    intermediate: 'Intermediate',
    advanced: 'Advanced',
};

const statusStyles = {
    idle: 'bg-gray-800 text-gray-200',
    starting: 'bg-yellow-300 text-black',
    ready: 'bg-[#adfa1d] text-black',
    in_progress: 'bg-[#adfa1d] text-black',
    processing: 'bg-orange-300 text-black',
    completed: 'bg-green-500 text-white',
    error: 'bg-red-500 text-white',
};

const statusLabels = {
    idle: 'Idle',
    starting: 'Creating Room',
    ready: 'Ready',
    in_progress: 'Live',
    processing: 'Finalizing Report',
    completed: 'Completed',
    error: 'Error',
};

const TranscriptPreview = ({ transcript }) => {
    if (!transcript.length) {
        return (
            <div className="border-2 border-dashed border-gray-300 bg-gray-50 p-4 text-sm font-bold text-gray-500">
                Transcript is still syncing from Tavus.
            </div>
        );
    }

    return (
        <div className="max-h-80 space-y-3 overflow-y-auto pr-2">
            {transcript.map((entry) => (
                <div
                    key={`${entry.sequence}-${entry.timestamp}`}
                    className={`border-2 border-black p-3 shadow-[3px_3px_0px_0px_#000] ${
                        entry.speaker === 'ai' ? 'bg-yellow-100' : 'bg-white'
                    }`}
                >
                    <div className="mb-1 text-xs font-black uppercase tracking-widest text-gray-500">
                        {entry.speaker === 'ai' ? 'Interviewer' : 'You'}
                    </div>
                    <p className="text-sm font-bold leading-relaxed text-black">{entry.text}</p>
                </div>
            ))}
        </div>
    );
};

const ReportSection = ({ report, transcript, onBack, onRetry }) => (
    <div className="min-h-screen bg-[#f4f0e8] px-4 py-6 text-black md:px-8">
        <div className="mx-auto max-w-6xl space-y-6">
            <div className="flex flex-col gap-4 border-b-4 border-black pb-4 md:flex-row md:items-end md:justify-between">
                <div>
                    <div className="mb-3 inline-flex items-center gap-2 border-2 border-black bg-[#adfa1d] px-3 py-1 text-xs font-black uppercase tracking-widest shadow-[4px_4px_0px_0px_#000]">
                        <Trophy className="h-4 w-4" />
                        Interview Report
                    </div>
                    <h1 className="text-4xl font-black uppercase tracking-tight md:text-5xl">
                        Session Complete
                    </h1>
                    <p className="mt-2 max-w-2xl text-sm font-bold text-gray-700 md:text-base">
                        Tavus finished the interview and SkillMeter turned the transcript into a structured review.
                    </p>
                </div>
                <div className="border-2 border-black bg-white px-6 py-4 shadow-[6px_6px_0px_0px_#000]">
                    <div className="text-xs font-black uppercase tracking-widest text-gray-500">Overall Score</div>
                    <div className="text-5xl font-black">{report?.overall_score ?? '-'}/10</div>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
                <Card className="rounded-none border-2 border-black bg-white p-6 shadow-[8px_8px_0px_0px_#000]">
                    <div className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-widest text-gray-500">
                        <BrainCircuit className="h-4 w-4" />
                        Summary
                    </div>
                    <p className="mb-6 text-base font-bold leading-7 text-black">
                        {report?.performance_summary}
                    </p>

                    <div className="grid gap-4 md:grid-cols-3">
                        <div className="border-2 border-black bg-[#fff2cc] p-4 shadow-[4px_4px_0px_0px_#000]">
                            <div className="text-xs font-black uppercase tracking-widest text-gray-500">Topic Knowledge</div>
                            <div className="mt-2 text-3xl font-black">{report?.topic_knowledge_score}/10</div>
                        </div>
                        <div className="border-2 border-black bg-[#d9f99d] p-4 shadow-[4px_4px_0px_0px_#000]">
                            <div className="text-xs font-black uppercase tracking-widest text-gray-500">Communication</div>
                            <div className="mt-2 text-3xl font-black">{report?.communication_score}/10</div>
                        </div>
                        <div className="border-2 border-black bg-[#fed7aa] p-4 shadow-[4px_4px_0px_0px_#000]">
                            <div className="text-xs font-black uppercase tracking-widest text-gray-500">Problem Solving</div>
                            <div className="mt-2 text-3xl font-black">{report?.problem_solving_score}/10</div>
                        </div>
                    </div>

                    <div className="mt-6 grid gap-6 md:grid-cols-2">
                        <div>
                            <div className="mb-3 text-sm font-black uppercase tracking-widest text-gray-500">Strengths</div>
                            <div className="space-y-3">
                                {(report?.strengths || []).map((item) => (
                                    <div key={item} className="flex gap-3 border-2 border-black bg-[#ecfccb] p-3 shadow-[3px_3px_0px_0px_#000]">
                                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                                        <p className="text-sm font-bold">{item}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <div className="mb-3 text-sm font-black uppercase tracking-widest text-gray-500">Improve Next</div>
                            <div className="space-y-3">
                                {(report?.improvements || []).map((item) => (
                                    <div key={item} className="border-2 border-black bg-[#fff1f2] p-3 shadow-[3px_3px_0px_0px_#000]">
                                        <p className="text-sm font-bold">{item}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {report?.recommendation && (
                        <div className="mt-6 border-2 border-black bg-black p-4 text-white shadow-[4px_4px_0px_0px_#adfa1d]">
                            <div className="mb-2 text-xs font-black uppercase tracking-widest text-[#adfa1d]">Recommendation</div>
                            <p className="text-sm font-bold leading-6">{report.recommendation}</p>
                        </div>
                    )}
                </Card>

                <div className="space-y-6">
                    <Card className="rounded-none border-2 border-black bg-white p-6 text-black shadow-[8px_8px_0px_0px_#000]">
                        <div className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-widest text-gray-500">
                            <FileText className="h-4 w-4" />
                            Transcript
                        </div>
                        <TranscriptPreview transcript={transcript} />
                    </Card>

                    <div className="grid gap-3">
                        <Button
                            onClick={onRetry}
                            className="h-14 rounded-none border-2 border-black bg-[#adfa1d] text-lg font-black uppercase tracking-widest text-black shadow-[6px_6px_0px_0px_#000] hover:bg-[#8ce000]"
                        >
                            Start Another Mock
                        </Button>
                        <Button
                            onClick={onBack}
                            variant="outline"
                            className="h-12 rounded-none border-2 border-black bg-white font-black uppercase tracking-widest shadow-[4px_4px_0px_0px_#000] hover:bg-black hover:text-white"
                        >
                            Back to Mentor Connect
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    </div>
);

const InterviewRoom = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { topic, level, resume } = location.state || {};

    const {
        sessionId,
        conversationUrl,
        status,
        error,
        report,
        transcript,
        isStarting,
        isEnding,
        startAISession,
        endAISession,
        resetSession,
    } = useAIInterview();

    const normalizedLevel = useMemo(
        () => levelMap[level] || level || 'intermediate',
        [level],
    );

    const prettyLevel = prettyLevelMap[level] || prettyLevelMap[normalizedLevel] || 'Intermediate';
    const liveSession = ['ready', 'in_progress'].includes(status);
    const isProcessing = status === 'processing' || isEnding;
    const hasReport = status === 'completed' && !!report;

    useEffect(() => {
        if (!topic && !sessionId) {
            toast.error('No interview configuration found. Please start from Mentor Connect.');
            navigate('/mentor-connect');
        }
    }, [navigate, sessionId, topic]);

    useEffect(() => {
        if (!liveSession && !isProcessing) {
            return undefined;
        }

        const handleBeforeUnload = (event) => {
            event.preventDefault();
            event.returnValue = '';
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isProcessing, liveSession]);

    useEffect(() => {
        if (error) {
            toast.error(error);
        }
    }, [error]);

    const handleStartSession = async () => {
        try {
            await startAISession({
                topic,
                level: normalizedLevel,
                resume,
            });
            toast.success('Tavus interview room is ready.');
        } catch (startError) {
            console.error(startError);
            toast.error('Unable to start the Tavus interview session.');
        }
    };

    const handleEndInterview = async () => {
        try {
            const result = await endAISession();
            if (result?.report_ready) {
                toast.success('Interview ended and report generated.');
            } else {
                toast.info('Interview ended. Final transcript is still syncing.');
            }
        } catch (endError) {
            console.error(endError);
            toast.error('Could not finish the interview cleanly.');
        }
    };

    const handleBackToMentorConnect = () => {
        resetSession();
        navigate('/mentor-connect');
    };

    const handleExit = async () => {
        if (isEnding) {
            return;
        }

        if (sessionId && !hasReport && status !== 'idle') {
            try {
                await endAISession({
                    awaitReport: false,
                    fetchFinalArtifacts: false,
                });
                toast.success('Session saved and Tavus interview closed.');
            } catch (endError) {
                console.error('Exit and save failed:', endError);
                toast.error('Could not save and close the Tavus session.');
                return;
            }
        }

        handleBackToMentorConnect();
    };

    const handleRetry = () => {
        resetSession();
        navigate('/mentor-connect', { replace: true });
    };

    if (!topic && !sessionId) {
        return null;
    }

    if (hasReport) {
        return (
            <ReportSection
                report={report}
                transcript={transcript}
                onBack={handleBackToMentorConnect}
                onRetry={handleRetry}
            />
        );
    }

    return (
        <div className="min-h-screen bg-[#111111] text-white">
            <div className="flex min-h-screen flex-col">
                <header className="border-b-4 border-black bg-[#f4f0e8] px-4 py-4 text-black md:px-6">
                    <div className="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-end md:justify-between">
                        <div className="space-y-2">
                            <div className="flex items-center gap-3">
                                <Button
                                    variant="outline"
                                    onClick={handleExit}
                                    disabled={isEnding}
                                    className="rounded-none border-2 border-black bg-white font-black uppercase shadow-[4px_4px_0px_0px_#000] hover:bg-black hover:text-white"
                                >
                                    <ArrowLeft className="mr-2 h-4 w-4" />
                                    {isEnding ? 'Saving...' : liveSession || isProcessing ? 'Exit & Save' : 'Back'}
                                </Button>
                                <Badge className={`rounded-none border-2 border-black font-black uppercase tracking-widest ${statusStyles[status] || statusStyles.idle}`}>
                                    {statusLabels[status] || status}
                                </Badge>
                            </div>
                            <h1 className="text-3xl font-black uppercase tracking-tight md:text-5xl">
                                Tavus Interview Room
                            </h1>
                            <p className="max-w-2xl text-sm font-bold text-gray-700 md:text-base">
                                SkillMeter is now using Tavus as the live interviewer. The room below handles the candidate audio and video directly.
                            </p>
                        </div>

                        <div className="grid gap-3 md:min-w-[280px]">
                            <div className="border-2 border-black bg-white px-4 py-3 shadow-[4px_4px_0px_0px_#000]">
                                <div className="text-xs font-black uppercase tracking-widest text-gray-500">Topic</div>
                                <div className="text-lg font-black">{topic}</div>
                            </div>
                            <div className="border-2 border-black bg-[#adfa1d] px-4 py-3 shadow-[4px_4px_0px_0px_#000]">
                                <div className="text-xs font-black uppercase tracking-widest text-black/60">Difficulty</div>
                                <div className="text-lg font-black">{prettyLevel}</div>
                            </div>
                        </div>
                    </div>
                </header>

                <main className="flex-1 bg-[#111111] px-4 py-6 md:px-6">
                    {!sessionId ? (
                        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
                            <div className="border-2 border-black bg-[#adfa1d] p-6 text-black shadow-[8px_8px_0px_0px_#000] md:p-8">
                                <div className="mb-6 flex items-center gap-3 text-sm font-black uppercase tracking-widest">
                                    <Sparkles className="h-5 w-5" />
                                    Session Checklist
                                </div>
                                <div className="space-y-4 text-sm font-bold md:text-base">
                                    <div className="flex gap-3 border-2 border-black bg-white p-4 shadow-[4px_4px_0px_0px_#000]">
                                        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                                        <div>
                                            <div className="font-black uppercase tracking-wide">Interview Topic</div>
                                            <div>{topic}</div>
                                        </div>
                                    </div>
                                    <div className="flex gap-3 border-2 border-black bg-white p-4 shadow-[4px_4px_0px_0px_#000]">
                                        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                                        <div>
                                            <div className="font-black uppercase tracking-wide">Difficulty Mode</div>
                                            <div>{prettyLevel}</div>
                                        </div>
                                    </div>
                                    <div className="flex gap-3 border-2 border-black bg-white p-4 shadow-[4px_4px_0px_0px_#000]">
                                        <Video className="mt-0.5 h-5 w-5 shrink-0" />
                                        <div>
                                            <div className="font-black uppercase tracking-wide">Camera And Mic</div>
                                            <div>Tavus will request permissions inside the interview room itself.</div>
                                        </div>
                                    </div>
                                    <div className="flex gap-3 border-2 border-black bg-white p-4 shadow-[4px_4px_0px_0px_#000]">
                                        <FileText className="mt-0.5 h-5 w-5 shrink-0" />
                                        <div>
                                            <div className="font-black uppercase tracking-wide">Resume Context</div>
                                            <div>{resume ? resume.name : 'No resume uploaded for this session.'}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="border-2 border-black bg-[#f4f0e8] p-6 text-black shadow-[8px_8px_0px_0px_#000] md:p-8">
                                <div className="mb-4 inline-flex items-center gap-2 border-2 border-black bg-black px-3 py-1 text-xs font-black uppercase tracking-widest text-[#adfa1d]">
                                    <BrainCircuit className="h-4 w-4" />
                                    Tavus Full Pipeline
                                </div>
                                <h2 className="text-3xl font-black uppercase tracking-tight">Ready To Run The Mock?</h2>
                                <p className="mt-4 text-sm font-bold leading-7 text-gray-700 md:text-base">
                                    This interview now runs directly in Tavus, so there’s no custom browser mic streaming or WebSocket relay sitting between you and the interviewer.
                                </p>
                                <div className="mt-6 border-2 border-black bg-white p-4 shadow-[4px_4px_0px_0px_#000]">
                                    <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-gray-500">
                                        <TimerReset className="h-4 w-4" />
                                        Best Practice
                                    </div>
                                    <p className="text-sm font-bold leading-6">
                                        Keep the browser tab focused, let Tavus handle permission prompts inside the room, and click “End Interview” here when you want SkillMeter to fetch the final transcript and report.
                                    </p>
                                </div>
                                <Button
                                    onClick={handleStartSession}
                                    disabled={isStarting}
                                    className="mt-8 h-16 w-full rounded-none border-2 border-black bg-[#adfa1d] text-xl font-black uppercase tracking-widest text-black shadow-[8px_8px_0px_0px_#000] hover:bg-[#8ce000]"
                                >
                                    {isStarting ? (
                                        <>
                                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                            Creating Room
                                        </>
                                    ) : (
                                        'Launch Tavus Interview'
                                    )}
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[1.3fr_0.7fr]">
                            <div className="min-h-[70vh] border-2 border-black bg-black shadow-[8px_8px_0px_0px_#adfa1d]">
                                {conversationUrl ? (
                                    <iframe
                                        src={conversationUrl}
                                        allow="camera; microphone; autoplay; fullscreen"
                                        className="h-[70vh] w-full border-0 lg:h-[78vh]"
                                        title="Tavus Interview Room"
                                    />
                                ) : (
                                    <div className="flex h-[70vh] items-center justify-center text-center text-white lg:h-[78vh]">
                                        <div className="space-y-4 px-6">
                                            <Loader2 className="mx-auto h-10 w-10 animate-spin text-[#adfa1d]" />
                                            <p className="text-sm font-black uppercase tracking-widest">
                                                {isStarting ? 'Preparing Tavus room...' : 'Waiting for room URL...'}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-6">
                                <Card className="rounded-none border-2 border-black bg-[#f4f0e8] p-6 text-black shadow-[8px_8px_0px_0px_#000]">
                                    <div className="mb-4 text-sm font-black uppercase tracking-widest text-gray-500">
                                        Session Control
                                    </div>
                                    <div className="space-y-4 text-sm font-bold leading-6">
                                        <p>
                                            The embedded Tavus room handles microphone capture, speech turns, and live interviewer responses directly.
                                        </p>
                                        <p>
                                            When you finish, use the button below so SkillMeter can close the conversation, sync the transcript, and generate your report.
                                        </p>
                                    </div>
                                    <Button
                                        onClick={handleEndInterview}
                                        disabled={isEnding || isProcessing}
                                        className="mt-6 h-14 w-full rounded-none border-2 border-black bg-red-500 text-lg font-black uppercase tracking-widest text-white shadow-[6px_6px_0px_0px_#000] hover:bg-red-600"
                                    >
                                        {(isEnding || isProcessing) ? (
                                            <>
                                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                                Finalizing
                                            </>
                                        ) : (
                                            'End Interview'
                                        )}
                                    </Button>
                                </Card>

                                <Card className="rounded-none border-2 border-black bg-white p-6 text-black shadow-[8px_8px_0px_0px_#000]">
                                    <div className="mb-4 text-sm font-black uppercase tracking-widest text-gray-500">
                                        Live Notes
                                    </div>
                                    <div className="space-y-3 text-sm font-bold">
                                        <div className="border-2 border-black bg-[#fff2cc] p-3 shadow-[3px_3px_0px_0px_#000]">
                                            Tavus room status: {statusLabels[status] || status}
                                        </div>
                                        <div className="border-2 border-black bg-[#ecfccb] p-3 shadow-[3px_3px_0px_0px_#000]">
                                            Keep the Tavus permission prompt open until the room fully joins.
                                        </div>
                                        <div className="border-2 border-black bg-[#fce7f3] p-3 shadow-[3px_3px_0px_0px_#000]">
                                            Your final report will appear here automatically after Tavus finishes the transcript sync.
                                        </div>
                                    </div>
                                </Card>

                                {isProcessing && (
                                    <Card className="rounded-none border-2 border-black bg-black p-6 text-white shadow-[8px_8px_0px_0px_#adfa1d]">
                                        <div className="flex items-center gap-3 text-sm font-black uppercase tracking-widest text-[#adfa1d]">
                                            <Loader2 className="h-5 w-5 animate-spin" />
                                            Syncing Tavus Transcript
                                        </div>
                                        <p className="mt-4 text-sm font-bold leading-6 text-gray-200">
                                            The conversation is already closed. SkillMeter is now pulling the final transcript and generating your feedback.
                                        </p>
                                    </Card>
                                )}
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default InterviewRoom;
