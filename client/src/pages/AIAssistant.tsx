import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.js";
import { Button } from "@/components/ui/button.js";
import { Input } from "@/components/ui/input.js";
import { ScrollArea } from "@/components/ui/scroll-area.js";
import { Badge } from "@/components/ui/badge.js";

import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient.js";
import { useToast } from "@/hooks/use-toast.js";
import {
  Bot,
  Send,
  Mic,
  MicOff,
  Lightbulb,
  TrendingUp,
  Users,
  Calendar,
  Mail,
  FileText,
} from "lucide-react";

// Speech Recognition types
type SpeechRecognitionEvent = Event & {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
    };
  };
};

interface Message {
  id: string;
  content: string;
  role: "user" | "assistant";
  timestamp: Date;
}

interface Insight {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: "high" | "medium" | "low";
  createdAt: string;
}

// Speech Recognition API types for window extensions



// Calendar event types
interface CalendarEventExtractedData {
  isRelevant?: boolean;
  isClientRelated?: boolean;
  confidence?: number;
  sessionType?: string;
  clientEmails?: string[];
}

interface UpcomingEvent {
  id: string;
  summary: string;
  startTime: string;
  extractedData?: CalendarEventExtractedData;
}



export default function AIAssistant() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Fetch AI insights
  const { data: insights } = useQuery<Insight[]>({
    queryKey: ["/api/ai/insights"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/ai/insights");
      return response.json() as Promise<Insight[]>;
    },
    refetchInterval: 300000, // Refetch every 5 minutes
  });

  // Fetch upcoming calendar events with AI analysis
  const { data: upcomingEvents } = useQuery<UpcomingEvent[]>({
    queryKey: ["/api/calendar/upcoming"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/calendar/upcoming?limit=10");
      return response.json() as Promise<UpcomingEvent[]>;
    },
    refetchInterval: 600000, // Refetch every 10 minutes
  });

  interface ChatResponse {
    message: string;
  }

  const chatMutation = useMutation({
    mutationFn: async (message: string): Promise<ChatResponse> => {
      const response = await apiRequest("POST", "/api/ai/chat", { message });
      return response.json() as Promise<ChatResponse>;
    },
    onSuccess: (response: ChatResponse) => {
      const assistantMessage: Message = {
        id: Date.now().toString() + "_assistant",
        content: response.message,
        role: "assistant",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to get AI response. Please try again.",
        variant: "destructive",
      });
    },
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    // Only scroll to bottom if there are messages and it's not the initial load
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages]);

  const handleSendMessage = () => {
    if (!inputMessage.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputMessage,
      role: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    chatMutation.mutate(inputMessage);
    setInputMessage("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const startVoiceRecognition = () => {
    if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      toast({
        title: 'Voice Recognition Not Supported',
        description: 'Your browser does not support speech recognition.',
        variant: 'destructive',
      });
      return;
    }

    const windowWithSpeech = window as unknown as {
      SpeechRecognition?: unknown;
      webkitSpeechRecognition?: unknown;
    };
    const SpeechRecognition = windowWithSpeech.SpeechRecognition ?? windowWithSpeech.webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new (SpeechRecognition as new () => {
        continuous: boolean;
        interimResults: boolean;
        lang: string;
        onstart: (() => void) | null;
        onresult: ((event: SpeechRecognitionEvent) => void) | null;
        onerror: (() => void) | null;
        onend: (() => void) | null;
        start: () => void;
      })();

      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = event.results[0][0].transcript;
        setInputMessage(transcript);
        setIsListening(false);
      };
      recognition.onerror = () => {
        setIsListening(false);
        toast({
          title: 'Recognition Error',
          description: 'Failed to recognize speech. Please try again.',
          variant: 'destructive',
        });
      };
      recognition.onend = () => setIsListening(false);
      recognition.start();
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case "medium":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "low":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case "contacts":
        return <Users className="h-4 w-4" />;
      case "calendar":
        return <Calendar className="h-4 w-4" />;
      case "email":
        return <Mail className="h-4 w-4" />;
      case "analytics":
        return <TrendingUp className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const quickPrompts = [
    "Summarize my recent client interactions",
    "What are my upcoming client sessions?",
    "Generate a follow-up email template",
    "Analyze my client engagement trends",
    "Suggest next steps for my top clients",
    "Review today's calendar for client sessions",
  ];

  return (
    <div className="h-full max-h-[calc(100vh-6rem)] flex flex-col lg:flex-row gap-3 lg:gap-6">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="mb-3 lg:mb-6">
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Bot className="h-6 w-6 lg:h-8 lg:w-8 text-teal-600" />
            AI Assistant
          </h1>
          <p className="text-muted-foreground text-sm lg:text-base">
            Get intelligent insights and assistance for your wellness practice.
          </p>
        </div>

        <Card className="flex-1 flex flex-col min-h-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Chat with AI</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col p-0 min-h-0">
            <ScrollArea className="flex-1 px-4 lg:px-6">
              <div className="space-y-4 pb-4">
                {messages.length === 0 && (
                  <div className="text-center py-8">
                    <Bot className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">Welcome to AI Assistant</h3>
                    <p className="text-muted-foreground mb-4">
                      Ask me anything about your clients, schedule, or get insights about your practice.
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {quickPrompts.slice(0, 3).map((prompt, index) => (
                        <Button
                          key={index}
                          variant="outline"
                          size="sm"
                          onClick={() => setInputMessage(prompt)}
                          className="text-xs"
                        >
                          {prompt}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-4 py-2 ${
                        message.role === "user"
                          ? "bg-teal-600 text-white"
                          : "bg-muted text-foreground"
                      }`}
                    >
                      <p className="text-sm">{message.content}</p>
                      <p className="text-xs opacity-70 mt-1">
                        {message.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}

                {chatMutation.isPending && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-lg px-4 py-2">
                      <div className="flex items-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-teal-600"></div>
                        <span className="text-sm text-muted-foreground">AI is thinking...</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div ref={messagesEndRef} />
            </ScrollArea>

            <div className="border-t p-3 lg:p-4">
              <div className="flex gap-2">
                <Input
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask me anything about your practice..."
                  className="flex-1"
                  disabled={chatMutation.isPending}
                />
                <Button
                  onClick={startVoiceRecognition}
                  variant="outline"
                  size="icon"
                  disabled={isListening}
                  className={isListening ? "bg-red-100 dark:bg-red-900" : ""}
                >
                  {isListening ? (
                    <MicOff className="h-4 w-4 text-red-600" />
                  ) : (
                    <Mic className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  onClick={handleSendMessage}
                  disabled={!inputMessage.trim() || chatMutation.isPending}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Insights & Events Sidebar */}
      <div className="w-full lg:w-80 lg:shrink-0 lg:max-h-full space-y-4">
        {/* Upcoming Events */}
        <Card className="lg:h-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-teal-600" />
              Upcoming Client Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-48 lg:h-60">
              <div className="space-y-3">
                {upcomingEvents && Array.isArray(upcomingEvents) && upcomingEvents.length > 0 ? (
                  upcomingEvents
                    .filter((event: UpcomingEvent) => event.extractedData?.isRelevant && event.extractedData?.isClientRelated)
                    .slice(0, 5)
                    .map((event: UpcomingEvent) => {
                      const startTime = new Date(event.startTime);
                      const isToday = startTime.toDateString() === new Date().toDateString();
                      const isSoon = startTime.getTime() - Date.now() < 2 * 60 * 60 * 1000; // Within 2 hours

                      return (
                        <div key={event.id} className={`border rounded-lg p-3 ${
                          isSoon ? 'border-orange-200 bg-orange-50 dark:bg-orange-950' :
                          isToday ? 'border-teal-200 bg-teal-50 dark:bg-teal-950' : ''
                        }`}>
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="font-medium text-sm line-clamp-2">{event.summary}</h4>
                            {event.extractedData?.confidence && (
                              <Badge variant="secondary" className="text-xs">
                                {Math.round(event.extractedData.confidence * 100)}%
                              </Badge>
                            )}
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {startTime.toLocaleDateString()} at {startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            {event.extractedData?.sessionType && (
                              <p className="text-xs text-teal-600 font-medium capitalize">
                                {event.extractedData.sessionType}
                              </p>
                            )}
{(event.extractedData?.clientEmails?.length ?? 0) > 0 && (
                              <p className="text-xs text-muted-foreground">
                                With: {event.extractedData?.clientEmails?.slice(0, 2).join(', ')}
                                {(event.extractedData?.clientEmails?.length ?? 0) > 2 && ` +${(event.extractedData?.clientEmails?.length ?? 0) - 2} more`}
                              </p>
                            )}
                          </div>
                          {isSoon && (
                            <div className="mt-2 text-xs text-orange-600 font-medium flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              Starting soon
                            </div>
                          )}
                        </div>
                      );
                    })
                ) : (
                  <div className="text-center py-8">
                    <Calendar className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      No upcoming client sessions found
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Events are filtered using AI to show only relevant client sessions
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* AI Insights */}
        <Card className="lg:h-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-yellow-500" />
              AI Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-48 lg:h-60">
              <div className="space-y-4">
                {insights && Array.isArray(insights) && insights.length > 0 ? (
                  insights.map((insight: Insight) => (
                    <div key={insight.id} className="border rounded-lg p-3">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getCategoryIcon(insight.category)}
                          <h4 className="font-medium text-sm">{insight.title}</h4>
                        </div>
                        <Badge className={getPriorityColor(insight.priority)} variant="secondary">
                          {insight.priority}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">
                        {insight.description}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(insight.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <Lightbulb className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      No insights available yet. Start chatting to generate insights!
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="hidden lg:block">
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {quickPrompts.map((prompt, index) => (
                <Button
                  key={index}
                  variant="ghost"
                  size="sm"
                  onClick={() => setInputMessage(prompt)}
                  className="w-full justify-start text-left h-auto py-2 px-3"
                >
                  <span className="text-xs">{prompt}</span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
