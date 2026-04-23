// src/components/ChatDuel.tsx
// ═══════════════════════════════════════════════════════════════════════════════
//  COMPOSANT CHAT POUR DUEL
//  - Icône flottante pour ouvrir/fermer le chat
//  - Messages en temps réel via Socket.IO
//  - Design moderne et non intrusif
//  - Notifications visuelles pour les nouveaux messages
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  Animated, Modal, KeyboardAvoidingView, Platform,
  StyleSheet, Dimensions, Vibration,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { C } from '../styles/theme';

const { width, height } = Dimensions.get('window');

export type MessageChat = {
  id: string;
  expediteur: string;
  texte: string;
  timestamp: number;
};

type Props = {
  socket: any;
  pseudo: string;
  adversairePseudo: string | null;
  estConnecte: boolean;
  etatPartie: string;
};

export const ChatDuel: React.FC<Props> = ({
  socket,
  pseudo,
  adversairePseudo,
  estConnecte,
  etatPartie,
}) => {
  const [messages, setMessages] = useState<MessageChat[]>([]);
  const [saisie, setSaisie] = useState('');
  const [chatVisible, setChatVisible] = useState(false);
  const [nonLu, setNonLu] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(height)).current;
  const flatListRef = useRef<FlatList>(null);

  // Animation d'ouverture/fermeture
  useEffect(() => {
    if (chatVisible) {
      setNonLu(0);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 40, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: height, friction: 8, tension: 40, useNativeDriver: true }),
      ]).start();
    }
  }, [chatVisible]);

  // Réception des messages via Socket.IO
  useEffect(() => {
    if (!socket) return;

    const handleMessageRecu = (data: { expediteur: string; message: string; timestamp: number }) => {
      const nouveauMessage: MessageChat = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        expediteur: data.expediteur,
        texte: data.message,
        timestamp: data.timestamp,
      };
      
      setMessages(prev => [...prev, nouveauMessage]);
      
      if (!chatVisible && data.expediteur !== pseudo) {
        Vibration.vibrate(50);
        setNonLu(prev => prev + 1);
      }
      
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    };

    socket.on('message_chat', handleMessageRecu);

    return () => {
      socket.off('message_chat', handleMessageRecu);
    };
  }, [socket, chatVisible, pseudo]);

  // Envoi d'un message
  const envoyerMessage = () => {
    if (!saisie.trim()) return;
    if (!estConnecte) return;
    if (!adversairePseudo) return;
    if (etatPartie === 'idle') return;

    const message = saisie.trim();
    setSaisie('');
    
    socket.emit('chat_message', {
      destinataire: adversairePseudo,
      message: message,
    });
    
    const nouveauMessage: MessageChat = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      expediteur: pseudo,
      texte: message,
      timestamp: Date.now(),
    };
    
    setMessages(prev => [...prev, nouveauMessage]);
    
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const formaterHeure = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  const renderMessage = ({ item }: { item: MessageChat }) => {
    const estMoi = item.expediteur === pseudo;
    
    return (
      <View style={[S.messageRow, estMoi ? S.messageRowMoi : S.messageRowAutre]}>
        <View style={[S.messageBubble, estMoi ? S.messageBubbleMoi : S.messageBubbleAutre]}>
          {!estMoi && (
            <Text style={S.messageExpediteur} numberOfLines={1}>
              {item.expediteur}
            </Text>
          )}
          <Text style={[S.messageTexte, estMoi ? S.messageTexteMoi : S.messageTexteAutre]}>
            {item.texte}
          </Text>
          <Text style={[S.messageHeure, estMoi ? S.messageHeureMoi : S.messageHeureAutre]}>
            {formaterHeure(item.timestamp)}
          </Text>
        </View>
      </View>
    );
  };

  // L'icône du chat n'apparaît que si un adversaire existe et que la partie n'est pas terminée
  if (!adversairePseudo || etatPartie === 'idle' || etatPartie === 'victoire' || etatPartie === 'defaite' || etatPartie === 'egal') {
    return null;
  }

  return (
    <>
      {/* Icône flottante */}
      <TouchableOpacity onPress={() => setChatVisible(true)} style={S.chatIcone} activeOpacity={0.85}>
        <LinearGradient colors={[C.primary, C.primaryDark]} style={S.chatIconeGrad}>
          <Text style={S.chatIconeTexte}>💬</Text>
          {nonLu > 0 && (
            <View style={S.chatBadge}>
              <Text style={S.chatBadgeTexte}>{nonLu > 9 ? '9+' : nonLu}</Text>
            </View>
          )}
        </LinearGradient>
      </TouchableOpacity>

      {/* Modale du chat */}
      <Modal transparent visible={chatVisible} animationType="none">
        <Animated.View style={[S.chatOverlay, { opacity: fadeAnim }]}>
          <TouchableOpacity style={S.chatOverlayTouch} activeOpacity={1} onPress={() => setChatVisible(false)} />
          <Animated.View style={[S.chatContainer, { transform: [{ translateY: slideAnim }] }]}>
            <LinearGradient colors={[C.bgCard, C.bgDeep]} style={S.chatHeader}>
              <View style={S.chatHeaderLeft}>
                <Text style={S.chatHeaderIcon}>💬</Text>
                <View>
                  <Text style={S.chatHeaderTitle}>Chat du duel</Text>
                  <Text style={S.chatHeaderSubtitle}>
                    {adversairePseudo ? `avec ${adversairePseudo}` : 'En attente...'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setChatVisible(false)} style={S.chatHeaderClose}>
                <Text style={S.chatHeaderCloseText}>✕</Text>
              </TouchableOpacity>
            </LinearGradient>

            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={item => item.id}
              renderItem={renderMessage}
              contentContainerStyle={S.chatMessagesList}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={S.chatEmpty}>
                  <Text style={S.chatEmptyEmoji}>💭</Text>
                  <Text style={S.chatEmptyTitle}>Aucun message</Text>
                  <Text style={S.chatEmptySub}>Soyez le premier à envoyer un message !</Text>
                </View>
              }
            />

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
              <View style={S.chatInputContainer}>
                <TextInput
                  style={S.chatInput}
                  value={saisie}
                  onChangeText={setSaisie}
                  placeholder="Écrivez votre message..."
                  placeholderTextColor={C.textHint}
                  multiline
                  maxLength={200}
                  editable={!!adversairePseudo && estConnecte && etatPartie !== 'idle'}
                  returnKeyType="send"
                  onSubmitEditing={envoyerMessage}
                />
                <TouchableOpacity
                  onPress={envoyerMessage}
                  style={[S.chatSendBtn, (!saisie.trim() || !adversairePseudo) && S.chatSendBtnDisabled]}
                  disabled={!saisie.trim() || !adversairePseudo}
                  activeOpacity={0.7}
                >
                  <LinearGradient
                    colors={saisie.trim() && adversairePseudo ? [C.primary, C.primaryDark] : [C.bgCardLit, C.bgCardLit]}
                    style={S.chatSendBtnGrad}
                  >
                    <Text style={[S.chatSendBtnText, (!saisie.trim() || !adversairePseudo) && { color: C.textHint }]}>
                      Envoyer
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </Animated.View>
        </Animated.View>
      </Modal>
    </>
  );
};

const S = StyleSheet.create({
  chatIcone: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    zIndex: 100,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  chatIconeGrad: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatIconeTexte: { fontSize: 28 },
  chatBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: C.red,
    borderRadius: 12,
    minWidth: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: C.bgCard,
  },
  chatBadgeTexte: { color: '#fff', fontSize: 11, fontWeight: '900' },
  chatOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  chatOverlayTouch: { flex: 1 },
  chatContainer: {
    backgroundColor: C.bgCard,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: height * 0.8,
    minHeight: height * 0.5,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 15,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  chatHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  chatHeaderIcon: { fontSize: 28 },
  chatHeaderTitle: { color: C.textPrimary, fontSize: 18, fontWeight: '900', letterSpacing: 0.5 },
  chatHeaderSubtitle: { color: C.textSecond, fontSize: 12, marginTop: 2 },
  chatHeaderClose: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.bgCardLit, alignItems: 'center', justifyContent: 'center' },
  chatHeaderCloseText: { color: C.textBody, fontSize: 18, fontWeight: '700' },
  chatMessagesList: { paddingHorizontal: 16, paddingVertical: 12, flexGrow: 1 },
  messageRow: { marginBottom: 12, flexDirection: 'row' },
  messageRowMoi: { justifyContent: 'flex-end' },
  messageRowAutre: { justifyContent: 'flex-start' },
  messageBubble: { maxWidth: '80%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20 },
  messageBubbleMoi: { backgroundColor: C.primary, borderBottomRightRadius: 4 },
  messageBubbleAutre: { backgroundColor: C.bgCardLit, borderBottomLeftRadius: 4 },
  messageExpediteur: { color: C.gold, fontSize: 11, fontWeight: '800', marginBottom: 4, letterSpacing: 0.5 },
  messageTexte: { fontSize: 14, lineHeight: 20 },
  messageTexteMoi: { color: '#fff' },
  messageTexteAutre: { color: C.textBody },
  messageHeure: { fontSize: 10, marginTop: 4, textAlign: 'right' },
  messageHeureMoi: { color: '#ffffffaa' },
  messageHeureAutre: { color: C.textHint },
  chatEmpty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  chatEmptyEmoji: { fontSize: 48, marginBottom: 16, opacity: 0.5 },
  chatEmptyTitle: { color: C.textSecond, fontSize: 16, fontWeight: '700', marginBottom: 8 },
  chatEmptySub: { color: C.textHint, fontSize: 13, textAlign: 'center' },
  chatInputContainer: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.bgCard, gap: 10 },
  chatInput: { flex: 1, backgroundColor: C.bgCardLit, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10, color: C.textPrimary, fontSize: 14, maxHeight: 80, borderWidth: 1, borderColor: C.border },
  chatSendBtn: { borderRadius: 28, overflow: 'hidden', justifyContent: 'center' },
  chatSendBtnDisabled: { opacity: 0.5 },
  chatSendBtnGrad: { paddingHorizontal: 20, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  chatSendBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
});

export default ChatDuel;