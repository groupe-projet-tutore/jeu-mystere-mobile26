// src/components/LanguageSwitcher.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, Modal, StyleSheet,
  Dimensions, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Language = {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
};

const LANGUAGES: Language[] = [
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
  { code: 'so', name: 'Somali', nativeName: 'Soomaali', flag: '🇸🇴' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦' },
];

type Props = {
  visible: boolean;
  onClose: () => void;
};

export const LanguageSwitcher: React.FC<Props> = ({ visible, onClose }) => {
  const { t } = useTranslation();
  const [selectedLang, setSelectedLang] = useState(i18n.language);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 40, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 0.9, friction: 8, tension: 40, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 50, friction: 8, tension: 40, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const changeLanguage = async (langCode: string) => {
    setSelectedLang(langCode);
    await i18n.changeLanguage(langCode);
    setTimeout(() => onClose(), 400);
  };

  return (
    <Modal transparent visible={visible} animationType="none">
      <Animated.View style={[S.overlay, { opacity: fadeAnim }]}>
        <TouchableOpacity style={S.overlayTouch} activeOpacity={1} onPress={onClose} />
        <Animated.View
          style={[
            S.modalContainer,
            {
              transform: [{ scale: scaleAnim }, { translateY: slideAnim }],
            },
          ]}
        >
          <LinearGradient
            colors={['#1a1a2e', '#0f0f1a']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={S.modalGrad}
          >
            <View style={S.header}>
              <View style={S.headerIconContainer}>
                <LinearGradient
                  colors={['#7F77DD', '#4a3f8a']}
                  style={S.headerIconGrad}
                >
                  <Text style={S.headerIcon}>🌐</Text>
                </LinearGradient>
              </View>
              <Text style={S.title}>{t('profil.language')}</Text>
              <Text style={S.subtitle}>Choose your language</Text>
              <TouchableOpacity onPress={onClose} style={S.closeBtn} activeOpacity={0.7}>
                <LinearGradient colors={['#2a2a4a', '#1a1a2e']} style={S.closeBtnGrad}>
                  <Text style={S.closeBtnText}>✕</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            <View style={S.languagesList}>
              {LANGUAGES.map((lang) => (
                <TouchableOpacity
                  key={lang.code}
                  style={[
                    S.languageItem,
                    selectedLang === lang.code && S.languageItemActive,
                  ]}
                  onPress={() => changeLanguage(lang.code)}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={
                      selectedLang === lang.code
                        ? ['#7F77DD20', '#4a3f8a20']
                        : ['#111827', '#0d0d1a']
                    }
                    style={S.languageItemGrad}
                  >
                    <View style={S.flagContainer}>
                      <Text style={S.flag}>{lang.flag}</Text>
                    </View>
                    <View style={S.languageInfo}>
                      <Text style={[S.languageName, selectedLang === lang.code && S.languageNameActive]}>
                        {lang.nativeName}
                      </Text>
                      <Text style={S.languageCode}>{lang.name}</Text>
                    </View>
                    {selectedLang === lang.code && (
                      <View style={S.checkmark}>
                        <LinearGradient colors={['#7F77DD', '#4a3f8a']} style={S.checkmarkGrad}>
                          <Text style={S.checkmarkText}>✓</Text>
                        </LinearGradient>
                      </View>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </View>

            <View style={S.footer}>
              <View style={S.footerLine} />
              <Text style={S.footerText}>L'application utilisera votre langue sélectionnée</Text>
            </View>
          </LinearGradient>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const S = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayTouch: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContainer: {
    width: SCREEN_WIDTH - 48,
    maxWidth: 400,
    borderRadius: 32,
    overflow: 'hidden',
    shadowColor: '#7F77DD',
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 20,
  },
  modalGrad: {
    borderRadius: 32,
    overflow: 'hidden',
  },
  header: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 20,
    paddingHorizontal: 24,
    position: 'relative',
  },
  headerIconContainer: {
    marginBottom: 16,
  },
  headerIconGrad: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7F77DD',
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 8,
  },
  headerIcon: {
    fontSize: 32,
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  subtitle: {
    color: '#7F77DD',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 6,
    textAlign: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
  },
  closeBtnGrad: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  languagesList: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 12,
  },
  languageItem: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  languageItemActive: {
    shadowColor: '#7F77DD',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  languageItemGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 20,
  },
  flagContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  flag: {
    fontSize: 28,
  },
  languageInfo: {
    flex: 1,
  },
  languageName: {
    color: '#c8d4e8',
    fontSize: 17,
    fontWeight: '600',
  },
  languageNameActive: {
    color: '#7F77DD',
  },
  languageCode: {
    color: '#6b7280',
    fontSize: 12,
    marginTop: 2,
  },
  checkmark: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
  },
  checkmarkGrad: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmarkText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 28,
    alignItems: 'center',
  },
  footerLine: {
    width: 60,
    height: 3,
    backgroundColor: '#7F77DD',
    borderRadius: 2,
    marginBottom: 16,
    opacity: 0.3,
  },
  footerText: {
    color: '#6b7280',
    fontSize: 11,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
});