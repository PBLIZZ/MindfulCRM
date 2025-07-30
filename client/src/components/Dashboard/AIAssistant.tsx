import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/queryClient";
import { Mic, MicOff, Send, Bot, Calendar, BarChart3, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
}

export default function AIAssistant() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      content: "Hello! I've analyzed your recent client interactions. I can help you with client insights, scheduling suggestions, and progress tracking. How can I assist you today?",
      isUser: false,
      timestamp: new Date(),
    },
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { isListening, startListening, stopListening, transcript } = useVoiceInput();

  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await apiRequest("POST", "/api/ai/chat", { 
        message,
        context: { userId: user?.id }
      });
      return response.json();
    },
    onSuccess: (data) => {
      const aiMessage: Message = {
        id: Date.now().toString(),
        content: data.response,
        isUser: false,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiMessage]);
    },
    onError: (error) => {
      const errorMessage: Message = {
        id: Date.now().toString(),
        content: "I'm sorry, I encountered an error. Please try again or check your OpenAI API configuration.",
        isUser: false,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/sync/manual", {});
      return response.json();
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (transcript) {
      setInputMessage(transcript);
    }
  }, [transcript]);

  const sendMessage = () => {
    if (!inputMessage.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputMessage,
      isUser: true,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    chatMutation.mutate(inputMessage);
    setInputMessage("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const toggleVoiceInput = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const quickActions = [
    {
      title: "Schedule Follow-up",
      description: "Create follow-up appointments for clients",
      icon: Calendar,
      action: () => setInputMessage("Help me schedule follow-up appointments for clients who need attention"),
    },
    {
      title: "Generate Report",
      description: "Create progress reports for clients",
      icon: BarChart3,
      action: () => setInputMessage("Generate a summary report of client progress this week"),
    },
    {
      title: "Sync Data",
      description: "Manually trigger Google services sync",
      icon: RefreshCw,
      action: () => syncMutation.mutate(),
    },
  ];

  return (
    <div className="space-y-6">
      {/* AI Assistant Chat */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold">AI Assistant</CardTitle>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-xs text-green-600 dark:text-green-400">Online</span>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="h-80 overflow-y-auto space-y-4 mb-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex items-start space-x-3 ${
                  message.isUser ? "justify-end" : ""
                }`}
              >
                {!message.isUser && (
                  <div className="w-8 h-8 bg-teal-100 dark:bg-teal-800 rounded-full flex items-center justify-center flex-shrink-0">
                    <Bot className="h-4 w-4 text-teal-600 dark:text-teal-300" />
                  </div>
                )}
                
                <div
                  className={`rounded-lg p-3 max-w-xs ${
                    message.isUser
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  <p className="text-sm">{message.content}</p>
                  <span className="text-xs opacity-70 mt-1 block">
                    {formatDistanceToNow(message.timestamp, { addSuffix: true })}
                  </span>
                </div>
                
                {message.isUser && (
                  <img
                    src={user?.picture || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=32&h=32&fit=crop&crop=face"}
                    alt={user?.name || "User"}
                    className="w-8 h-8 rounded-full flex-shrink-0"
                  />
                )}
              </div>
            ))}
            
            {chatMutation.isPending && (
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-teal-100 dark:bg-teal-800 rounded-full flex items-center justify-center flex-shrink-0">
                  <Bot className="h-4 w-4 text-teal-600 dark:text-teal-300" />
                </div>
                <div className="bg-muted rounded-lg p-3">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
          
          <div className="flex space-x-2">
            <Input
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask about client progress..."
              className="flex-1"
              disabled={chatMutation.isPending}
            />
            <Button
              onClick={toggleVoiceInput}
              variant={isListening ? "destructive" : "outline"}
              size="icon"
              className={isListening ? "animate-voice-active" : ""}
            >
              {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
            <Button
              onClick={sendMessage}
              disabled={!inputMessage.trim() || chatMutation.isPending}
              size="icon"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {quickActions.map((action, index) => (
            <Button
              key={index}
              variant="ghost"
              className="w-full justify-start h-auto p-3"
              onClick={action.action}
              disabled={action.title === "Sync Data" && syncMutation.isPending}
            >
              <div className="flex items-center space-x-3">
                <action.icon className="h-5 w-5 text-primary" />
                <div className="text-left">
                  <span className="font-medium block">{action.title}</span>
                  <p className="text-sm text-muted-foreground">{action.description}</p>
                </div>
              </div>
            </Button>
          ))}
        </CardContent>
      </Card>
      
      {/* Upcoming Sessions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Upcoming Sessions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-center py-8 text-muted-foreground">
            No upcoming sessions found. Sync your Google Calendar to see scheduled appointments.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
