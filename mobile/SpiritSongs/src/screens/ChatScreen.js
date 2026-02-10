import React, { useState, useEffect, useRef, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { chatAPI } from '../services/api';
import { AuthContext } from '../context/AuthContext';

export default function ChatScreen({ navigation }) {
  const { user } = useContext(AuthContext);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const flatListRef = useRef(null);

  // Initialize chat
  useEffect(() => {
    initializeChat();
  }, []);

  const initializeChat = async () => {
    setLoading(true);
    try {
      // Try to get existing support chat or create new one
      const response = await chatAPI.getSupportChat();
      if (response.data.success) {
        setConversationId(response.data.conversation_id);
        setMessages(response.data.messages || []);
      }
    } catch (error) {
      console.error('Chat init error:', error);
      // If no chat exists, show welcome message
      setMessages([{
        id: 'welcome',
        message: 'Welcome to SpiritSongs Support! How can we help you today?',
        sender: 'support',
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim()) return;

    const messageText = inputText.trim();
    setInputText('');
    setSending(true);

    // Add message optimistically
    const tempMessage = {
      id: `temp-${Date.now()}`,
      message: messageText,
      sender: 'user',
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempMessage]);

    try {
      if (conversationId) {
        await chatAPI.sendMessage(conversationId, messageText);
      } else {
        // Start new support chat
        const response = await chatAPI.startSupportChat();
        if (response.data.success) {
          setConversationId(response.data.conversation_id);
        }
      }

      // Add auto-reply (simulated support response)
      setTimeout(() => {
        const autoReply = {
          id: `reply-${Date.now()}`,
          message: getAutoReply(messageText),
          sender: 'support',
          timestamp: new Date().toISOString(),
        };
        setMessages(prev => [...prev, autoReply]);
      }, 1500);

    } catch (error) {
      console.error('Send message error:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  // Simple auto-reply logic (can be enhanced with AI later)
  const getAutoReply = (userMessage) => {
    const lowerMsg = userMessage.toLowerCase();
    
    if (lowerMsg.includes('subscription') || lowerMsg.includes('payment') || lowerMsg.includes('plan')) {
      return "For subscription and payment inquiries, please go to Profile > Subscription Plans. If you're facing payment issues, please send us a detailed feedback through the Feedback option in settings.";
    }
    if (lowerMsg.includes('download') || lowerMsg.includes('offline')) {
      return "To download songs for offline listening, tap the download icon on any song. Downloaded songs will be available in your Library under 'Downloads'.";
    }
    if (lowerMsg.includes('bible') || lowerMsg.includes('verse')) {
      return "You can access the Bible section from the bottom navigation. We have full Bible text with audio reading feature available!";
    }
    if (lowerMsg.includes('bug') || lowerMsg.includes('error') || lowerMsg.includes('crash')) {
      return "Sorry to hear you're experiencing issues! Please submit a detailed bug report through Settings > Send Feedback with the 'Bug Report' option selected.";
    }
    if (lowerMsg.includes('hello') || lowerMsg.includes('hi') || lowerMsg.includes('hey')) {
      return "Hello! Welcome to SpiritSongs Support. How can I assist you today?";
    }
    
    return "Thank you for reaching out! Our support team will review your message and get back to you soon. For faster assistance, you can also email us at support@spiritsongs.app";
  };

  const renderMessage = ({ item }) => {
    const isUser = item.sender === 'user';
    
    return (
      <View style={[styles.messageRow, isUser && styles.messageRowUser]}>
        {!isUser && (
          <View style={styles.avatarSupport}>
            <Ionicons name="headset" size={16} color="#8b5cf6" />
          </View>
        )}
        <View style={[
          styles.messageBubble,
          isUser ? styles.messageBubbleUser : styles.messageBubbleSupport
        ]}>
          <Text style={[
            styles.messageText,
            isUser && styles.messageTextUser
          ]}>
            {item.message}
          </Text>
          <Text style={styles.messageTime}>
            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
        {isUser && (
          <View style={styles.avatarUser}>
            <Ionicons name="person" size={16} color="#fff" />
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#0a0a1a', '#1a1a2e', '#0a0a1a']}
        style={StyleSheet.absoluteFill}
      />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.headerAvatar}>
            <Ionicons name="headset" size={20} color="#8b5cf6" />
          </View>
          <View>
            <Text style={styles.headerTitle}>Support Chat</Text>
            <Text style={styles.headerSubtitle}>We're here to help</Text>
          </View>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#8b5cf6" />
            <Text style={styles.loadingText}>Loading chat...</Text>
          </View>
        ) : (
          <>
            {/* Messages List */}
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={renderMessage}
              contentContainerStyle={styles.messagesList}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="chatbubbles-outline" size={48} color="#666" />
                  <Text style={styles.emptyText}>Start a conversation</Text>
                </View>
              }
            />

            {/* Quick Actions */}
            <View style={styles.quickActions}>
              <TouchableOpacity 
                style={styles.quickActionChip}
                onPress={() => setInputText('I need help with subscription')}
              >
                <Text style={styles.quickActionText}>Subscription Help</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.quickActionChip}
                onPress={() => setInputText('How do I download songs?')}
              >
                <Text style={styles.quickActionText}>Download Songs</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.quickActionChip}
                onPress={() => setInputText('Report a bug')}
              >
                <Text style={styles.quickActionText}>Report Bug</Text>
              </TouchableOpacity>
            </View>

            {/* Input Area */}
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Type your message..."
                placeholderTextColor="#666"
                value={inputText}
                onChangeText={setInputText}
                multiline
                maxLength={1000}
              />
              <TouchableOpacity
                style={[styles.sendButton, (!inputText.trim() || sending) && styles.sendButtonDisabled]}
                onPress={sendMessage}
                disabled={!inputText.trim() || sending}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="send" size={20} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a1a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backButton: {
    padding: 8,
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#22c55e',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#666',
    marginTop: 12,
  },
  messagesList: {
    padding: 16,
    paddingBottom: 8,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  messageRowUser: {
    justifyContent: 'flex-end',
  },
  avatarSupport: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  avatarUser: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#8b5cf6',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  messageBubble: {
    maxWidth: '75%',
    borderRadius: 16,
    padding: 12,
  },
  messageBubbleSupport: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderBottomLeftRadius: 4,
  },
  messageBubbleUser: {
    backgroundColor: '#8b5cf6',
    borderBottomRightRadius: 4,
  },
  messageText: {
    fontSize: 15,
    color: '#fff',
    lineHeight: 20,
  },
  messageTextUser: {
    color: '#fff',
  },
  messageTime: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyText: {
    color: '#666',
    marginTop: 12,
    fontSize: 15,
  },
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  quickActionChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  quickActionText: {
    fontSize: 12,
    color: '#a78bfa',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    gap: 12,
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#fff',
    maxHeight: 100,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#8b5cf6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});
