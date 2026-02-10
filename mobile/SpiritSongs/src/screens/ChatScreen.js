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
import api from '../services/api';
import { AuthContext } from '../context/AuthContext';

export default function ChatScreen({ navigation }) {
  const { user, token } = useContext(AuthContext);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [showSatisfaction, setShowSatisfaction] = useState(false);
  const flatListRef = useRef(null);

  // Initialize chat
  useEffect(() => {
    initializeChat();
  }, []);

  const initializeChat = async () => {
    setLoading(true);
    try {
      const response = await api.get('/chat/support', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      
      if (response.data && response.data.success) {
        setConversationId(response.data.conversation_id);
        setMessages(response.data.messages || []);
      }
    } catch (error) {
      console.error('Chat init error:', error);
      // Show welcome message on error
      setMessages([{
        id: 'welcome',
        message: 'Karibu kwenye Msaada wa SpiritSongs! Ninawezaje kukusaidia leo?',
        sender: 'ai',
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim() || sending) return;

    const messageText = inputText.trim();
    setInputText('');
    setSending(true);

    // Add user message optimistically
    const tempUserMessage = {
      id: `user-${Date.now()}`,
      message: messageText,
      sender: 'user',
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempUserMessage]);

    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      // Use the new support message endpoint
      const response = await api.post('/chat/support/message', 
        { message: messageText },
        { headers }
      );
      
      if (response.data && response.data.success) {
        if (response.data.conversation_id) {
          setConversationId(response.data.conversation_id);
        }
        
        // Add AI response
        if (response.data.ai_response) {
          const aiMessage = {
            id: response.data.ai_response.id || `ai-${Date.now()}`,
            message: response.data.ai_response.message,
            sender: 'ai',
            timestamp: response.data.ai_response.timestamp || new Date().toISOString(),
          };
          setMessages(prev => [...prev, aiMessage]);
        }
      }
    } catch (error) {
      console.error('Send message error:', error);
      // Add fallback response on error
      const fallbackMessage = {
        id: `fallback-${Date.now()}`,
        message: 'Samahani, kuna tatizo la mtandao. Tafadhali jaribu tena.',
        sender: 'ai',
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, fallbackMessage]);
    } finally {
      setSending(false);
    }
  };

  const requestHumanAgent = async () => {
    if (!conversationId) {
      Alert.alert('Taarifa', 'Tafadhali anza mazungumzo kwanza.');
      return;
    }
    
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await api.post(`/chat/support/handover/${conversationId}`, {}, { headers });
      
      Alert.alert(
        'Ombi Limepokelewa',
        'Timu yetu ya msaada itakujibu hivi karibuni.',
        [{ text: 'Sawa' }]
      );
    } catch (error) {
      console.error('Handover error:', error);
      Alert.alert('Kosa', 'Imeshindikana kutuma ombi. Jaribu tena.');
    }
  };

  const submitSatisfaction = async (rating) => {
    if (!conversationId) return;
    
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await api.post(`/chat/support/satisfaction/${conversationId}`, 
        { rating },
        { headers }
      );
      setShowSatisfaction(false);
      Alert.alert('Asante!', 'Maoni yako yamepokelewa.');
    } catch (error) {
      console.error('Satisfaction error:', error);
    }
  };

  const renderMessage = ({ item }) => {
    const isUser = item.sender === 'user';
    const isSystem = item.sender === 'system';
    
    return (
      <View style={[
        styles.messageRow, 
        isUser && styles.messageRowUser,
        isSystem && styles.messageRowSystem
      ]}>
        {!isUser && !isSystem && (
          <View style={styles.avatarSupport}>
            <Ionicons name="sparkles" size={16} color="#8b5cf6" />
          </View>
        )}
        <View style={[
          styles.messageBubble,
          isUser ? styles.messageBubbleUser : 
          isSystem ? styles.messageBubbleSystem : styles.messageBubbleAI
        ]}>
          <Text style={[
            styles.messageText,
            isUser && styles.messageTextUser,
            isSystem && styles.messageTextSystem
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

  const renderSatisfactionModal = () => (
    <View style={styles.satisfactionOverlay}>
      <View style={styles.satisfactionModal}>
        <Text style={styles.satisfactionTitle}>Je, umeridhika na msaada?</Text>
        <View style={styles.satisfactionStars}>
          {[1, 2, 3, 4, 5].map(star => (
            <TouchableOpacity key={star} onPress={() => submitSatisfaction(star)}>
              <Ionicons name="star" size={32} color="#fbbf24" style={styles.star} />
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity 
          style={styles.satisfactionClose}
          onPress={() => setShowSatisfaction(false)}
        >
          <Text style={styles.satisfactionCloseText}>Baadaye</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

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
            <Ionicons name="sparkles" size={20} color="#8b5cf6" />
          </View>
          <View>
            <Text style={styles.headerTitle}>Msaada wa AI</Text>
            <Text style={styles.headerSubtitle}>Tupo hapa kukusaidia</Text>
          </View>
        </View>
        <TouchableOpacity onPress={requestHumanAgent} style={styles.humanButton}>
          <Ionicons name="person" size={20} color="#8b5cf6" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#8b5cf6" />
            <Text style={styles.loadingText}>Inapakia mazungumzo...</Text>
          </View>
        ) : (
          <>
            {/* Messages List */}
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item, index) => item.id || `msg-${index}`}
              renderItem={renderMessage}
              contentContainerStyle={styles.messagesList}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() => {
                if (flatListRef.current && messages.length > 0) {
                  flatListRef.current.scrollToEnd({ animated: true });
                }
              }}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="chatbubbles-outline" size={48} color="#666" />
                  <Text style={styles.emptyText}>Anza mazungumzo</Text>
                </View>
              }
            />

            {/* Quick Actions */}
            <View style={styles.quickActions}>
              <TouchableOpacity 
                style={styles.quickActionChip}
                onPress={() => setInputText('Ninahitaji msaada wa subscription')}
              >
                <Text style={styles.quickActionText}>Subscription</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.quickActionChip}
                onPress={() => setInputText('Jinsi ya kupakua nyimbo?')}
              >
                <Text style={styles.quickActionText}>Downloads</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.quickActionChip}
                onPress={() => setInputText('Naomba msaada wa mtu')}
              >
                <Text style={styles.quickActionText}>Mtu wa Msaada</Text>
              </TouchableOpacity>
            </View>

            {/* Input Area */}
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Andika ujumbe..."
                placeholderTextColor="#666"
                value={inputText}
                onChangeText={setInputText}
                multiline
                maxLength={1000}
                editable={!sending}
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

            {/* End Chat & Rate */}
            {messages.length > 2 && (
              <TouchableOpacity 
                style={styles.rateButton}
                onPress={() => setShowSatisfaction(true)}
              >
                <Ionicons name="star-outline" size={16} color="#8b5cf6" />
                <Text style={styles.rateButtonText}>Tathmini Mazungumzo</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </KeyboardAvoidingView>

      {/* Satisfaction Modal */}
      {showSatisfaction && renderSatisfactionModal()}
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
  humanButton: {
    padding: 8,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    borderRadius: 20,
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
  messageRowSystem: {
    justifyContent: 'center',
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
  messageBubbleAI: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderBottomLeftRadius: 4,
  },
  messageBubbleUser: {
    backgroundColor: '#8b5cf6',
    borderBottomRightRadius: 4,
  },
  messageBubbleSystem: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    maxWidth: '90%',
  },
  messageText: {
    fontSize: 15,
    color: '#fff',
    lineHeight: 20,
  },
  messageTextUser: {
    color: '#fff',
  },
  messageTextSystem: {
    color: '#9ca3af',
    fontStyle: 'italic',
    textAlign: 'center',
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
    flexWrap: 'wrap',
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
  rateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 6,
  },
  rateButtonText: {
    fontSize: 12,
    color: '#8b5cf6',
  },
  satisfactionOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  satisfactionModal: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    width: '80%',
  },
  satisfactionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 20,
    textAlign: 'center',
  },
  satisfactionStars: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  star: {
    padding: 4,
  },
  satisfactionClose: {
    padding: 8,
  },
  satisfactionCloseText: {
    color: '#666',
    fontSize: 14,
  },
});
