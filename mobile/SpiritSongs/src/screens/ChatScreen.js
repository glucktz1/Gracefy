import React, { useState, useEffect, useRef } from 'react';
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_BASE_URL } from '../services/api';

// Use the API URL from services/api.js
const API_URL = API_BASE_URL;

// Safe message parser to prevent crashes
const parseMessage = (msg, index) => {
  if (!msg) return null;
  return {
    id: msg.id || msg._id || `msg-${index}-${Date.now()}`,
    message: msg.message || msg.content || msg.text || '',
    sender: msg.sender || msg.role || 'ai',
    timestamp: msg.timestamp || msg.created_at || new Date().toISOString(),
  };
};

export default function ChatScreen({ navigation }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [showSatisfaction, setShowSatisfaction] = useState(false);
  const [token, setToken] = useState(null);
  const [error, setError] = useState(null);
  const flatListRef = useRef(null);

  // Get token on mount
  useEffect(() => {
    const getToken = async () => {
      try {
        const storedToken = await AsyncStorage.getItem('userToken');
        setToken(storedToken);
      } catch (e) {
        console.log('Error getting token:', e);
        // Don't crash - just continue without token
      }
    };
    getToken();
  }, []);

  // Initialize chat after token is loaded
  useEffect(() => {
    initializeChat();
  }, [token]);

  const initializeChat = async () => {
    setLoading(true);
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.get(`${API_URL}/chat/support`, { 
        headers,
        timeout: 10000 
      });
      
      if (response.data && response.data.success) {
        setConversationId(response.data.conversation_id);
        const rawMsgs = response.data.messages || [];
        // Parse messages safely to prevent crashes
        const msgs = rawMsgs.map((m, i) => parseMessage(m, i)).filter(m => m && m.message);
        setMessages(msgs.length > 0 ? msgs : [{
          id: 'welcome',
          message: 'Karibu kwenye Msaada wa SpiritSongs! Ninawezaje kukusaidia leo?',
          sender: 'ai',
          timestamp: new Date().toISOString(),
        }]);
      } else {
        // Show welcome message
        setMessages([{
          id: 'welcome',
          message: 'Karibu kwenye Msaada wa SpiritSongs! Ninawezaje kukusaidia leo?',
          sender: 'ai',
          timestamp: new Date().toISOString(),
        }]);
      }
    } catch (error) {
      console.log('Chat init error:', error?.message || error);
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
    const text = inputText?.trim();
    if (!text || sending) return;

    setInputText('');
    setSending(true);

    // Add user message optimistically
    const tempUserMessage = {
      id: `user-${Date.now()}`,
      message: text,
      sender: 'user',
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempUserMessage]);

    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      const response = await axios.post(
        `${API_URL}/chat/support/message`, 
        { message: text },
        { headers, timeout: 30000 }
      );
      
      if (response.data && response.data.success) {
        if (response.data.conversation_id) {
          setConversationId(response.data.conversation_id);
        }
        
        // Add AI response
        if (response.data.ai_response && response.data.ai_response.message) {
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
      console.log('Send message error:', error?.message || error);
      console.log('Error details:', JSON.stringify(error?.response?.data || {}));
      
      // Check if it's a timeout or network error
      let errorMessage = 'Samahani, kuna tatizo la mtandao. Tafadhali jaribu tena baadaye.';
      
      if (error?.response?.status === 500) {
        errorMessage = 'Huduma yetu ina shida kwa muda. Tafadhali jaribu tena.';
      } else if (error?.code === 'ECONNABORTED' || error?.message?.includes('timeout')) {
        errorMessage = 'Muda wa kusubiri umekwisha. Tafadhali angalia mtandao wako na ujaribu tena.';
      } else if (error?.message?.includes('Network Error')) {
        errorMessage = 'Hakuna mtandao. Tafadhali angalia uhusiano wako wa intaneti.';
      }
      
      // Add fallback response on error
      const fallbackMessage = {
        id: `fallback-${Date.now()}`,
        message: errorMessage,
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
      await axios.post(`${API_URL}/chat/support/handover/${conversationId}`, {}, { headers, timeout: 10000 });
      
      Alert.alert(
        'Ombi Limepokelewa',
        'Timu yetu ya msaada itakujibu hivi karibuni.',
        [{ text: 'Sawa' }]
      );
    } catch (error) {
      console.log('Handover error:', error?.message || error);
      Alert.alert('Kosa', 'Imeshindikana kutuma ombi. Jaribu tena.');
    }
  };

  const submitSatisfaction = async (rating) => {
    setShowSatisfaction(false);
    
    if (!conversationId) return;
    
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.post(
        `${API_URL}/chat/support/satisfaction/${conversationId}`, 
        { rating },
        { headers, timeout: 10000 }
      );
      Alert.alert('Asante!', 'Maoni yako yamepokelewa.');
    } catch (error) {
      console.log('Satisfaction error:', error?.message || error);
    }
  };

  const renderMessage = ({ item, index }) => {
    // Defensive check - skip invalid messages
    if (!item) return null;
    
    const messageText = item.message || item.content || item.text || '';
    if (!messageText) return null;
    
    const isUser = item.sender === 'user';
    const isSystem = item.sender === 'system';
    
    // Safe timestamp formatting
    let timeString = '';
    try {
      if (item.timestamp) {
        timeString = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
    } catch (e) {
      timeString = '';
    }
    
    return (
      <View 
        key={item.id || `msg-${index}`}
        style={[
          styles.messageRow, 
          isUser && styles.messageRowUser,
          isSystem && styles.messageRowSystem
        ]}
      >
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
            {messageText}
          </Text>
          {timeString ? (
            <Text style={styles.messageTime}>{timeString}</Text>
          ) : null}
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
            <Ionicons name="sparkles" size={20} color="#8b5cf6" />
          </View>
          <View>
            <Text style={styles.headerTitle}>Ongea nasi wakati wowote</Text>
            <Text style={styles.headerSubtitle}>Tupo hapa kukusaidia</Text>
          </View>
        </View>
        <TouchableOpacity onPress={requestHumanAgent} style={styles.humanButton}>
          <Ionicons name="person" size={20} color="#8b5cf6" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#8b5cf6" />
            <Text style={styles.loadingText}>Inapakia mazungumzo...</Text>
          </View>
        ) : (
          <View style={styles.chatContainer}>
            {/* Messages List */}
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item, index) => item?.id || `msg-${index}`}
              renderItem={renderMessage}
              contentContainerStyle={styles.messagesList}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() => {
                if (flatListRef.current && messages.length > 0) {
                  setTimeout(() => {
                    flatListRef.current?.scrollToEnd({ animated: true });
                  }, 100);
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
                style={[styles.sendButton, (!inputText?.trim() || sending) && styles.sendButtonDisabled]}
                onPress={sendMessage}
                disabled={!inputText?.trim() || sending}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="send" size={20} color="#fff" />
                )}
              </TouchableOpacity>
            </View>

            {/* Rate Button */}
            {messages.length > 2 && (
              <TouchableOpacity 
                style={styles.rateButton}
                onPress={() => setShowSatisfaction(true)}
              >
                <Ionicons name="star-outline" size={16} color="#8b5cf6" />
                <Text style={styles.rateButtonText}>Tathmini Mazungumzo</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </KeyboardAvoidingView>

      {/* Satisfaction Modal */}
      {showSatisfaction && (
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
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a1a',
  },
  keyboardView: {
    flex: 1,
  },
  chatContainer: {
    flex: 1,
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
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
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
    flexGrow: 1,
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
    flexWrap: 'wrap',
  },
  quickActionChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    marginRight: 8,
    marginBottom: 8,
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
    marginRight: 12,
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
  },
  rateButtonText: {
    fontSize: 12,
    color: '#8b5cf6',
    marginLeft: 6,
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
