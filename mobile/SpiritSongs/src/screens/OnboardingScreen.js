import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ImageBackground,
  TouchableOpacity,
  Animated,
  StatusBar,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../config/theme';

const { width, height } = Dimensions.get('window');

// Onboarding slides data
const slides = [
  {
    id: 1,
    image: require('../assets/onboarding/splash1.jpg'),
    title: 'Gracefy',
    subtitle: 'Sali, Imba, Tafakari',
    description: 'Wakati wowote, mahali popote.',
    highlight: 'Karibu!',
  },
  {
    id: 2,
    image: require('../assets/onboarding/splash2.jpg'),
    title: 'Kwaya & Nyimbo',
    subtitle: 'Furahia muziki wa Kikristo',
    description: 'Kwaya na nyimbo mbali mbali kiganjani mwako wakati wowote.',
    highlight: 'Sikiliza',
  },
  {
    id: 3,
    image: require('../assets/onboarding/splash3.jpg'),
    title: 'Tafakari ya Neno',
    subtitle: 'Biblia & Mafundisho',
    description: 'Pata tafakari ya neno, sikiliza Biblia, mafundisho na katekesi popote.',
    highlight: 'Jifunze',
  },
  {
    id: 4,
    image: require('../assets/onboarding/splash4.jpg'),
    title: 'Anza Safari Yako',
    subtitle: 'Mungu akubariki',
    description: 'Jiunge nasi leo na ufurahie muziki wa kiroho.',
    highlight: 'Tuanze!',
  },
];

const OnboardingScreen = ({ navigation, onComplete }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const slideRef = useRef(null);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Entry animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 4,
        useNativeDriver: true,
      }),
    ]).start();

    // Pulse animation for CTA
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      slideRef.current?.scrollTo({
        x: (currentSlide + 1) * width,
        animated: true,
      });
      setCurrentSlide(currentSlide + 1);
    } else {
      completeOnboarding();
    }
  };

  const handleSkip = () => {
    completeOnboarding();
  };

  const completeOnboarding = async () => {
    try {
      await AsyncStorage.setItem('hasSeenOnboarding', 'true');
      if (onComplete) {
        onComplete();
      }
    } catch (error) {
      console.error('Error saving onboarding state:', error);
    }
  };

  const handleScroll = (event) => {
    const slideIndex = Math.round(event.nativeEvent.contentOffset.x / width);
    setCurrentSlide(slideIndex);
  };

  const renderSlide = ({ item, index }) => {
    const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
    
    const scale = scrollX.interpolate({
      inputRange,
      outputRange: [0.9, 1, 0.9],
      extrapolate: 'clamp',
    });

    const opacity = scrollX.interpolate({
      inputRange,
      outputRange: [0.5, 1, 0.5],
      extrapolate: 'clamp',
    });

    return (
      <View style={styles.slide}>
        <ImageBackground
          source={item.image}
          style={styles.backgroundImage}
          resizeMode="cover"
        >
          {/* Gradient overlay */}
          <LinearGradient
            colors={['transparent', 'rgba(10, 22, 40, 0.6)', 'rgba(10, 22, 40, 0.95)']}
            style={styles.gradient}
            locations={[0, 0.4, 0.8]}
          >
            <Animated.View 
              style={[
                styles.contentContainer,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                }
              ]}
            >
              {/* Logo - only on first slide */}
              {index === 0 && (
                <Animated.View style={[styles.logoContainer, { transform: [{ scale: logoScale }] }]}>
                  <View style={styles.logoWrapper}>
                    <LinearGradient
                      colors={[COLORS.primary, COLORS.primaryDark]}
                      style={styles.logoGradient}
                    >
                      <Ionicons name="musical-notes" size={40} color={COLORS.text} />
                      <View style={styles.crossIcon}>
                        <Ionicons name="add" size={20} color={COLORS.text} />
                      </View>
                    </LinearGradient>
                  </View>
                </Animated.View>
              )}

              {/* Highlight badge */}
              <View style={styles.highlightBadge}>
                <Text style={styles.highlightText}>{item.highlight}</Text>
              </View>

              {/* Title */}
              <Text style={styles.title}>{item.title}</Text>
              
              {/* Subtitle */}
              <Text style={styles.subtitle}>{item.subtitle}</Text>
              
              {/* Description */}
              <Text style={styles.description}>{item.description}</Text>
            </Animated.View>
          </LinearGradient>
        </ImageBackground>
      </View>
    );
  };

  const renderPagination = () => {
    return (
      <View style={styles.paginationContainer}>
        {slides.map((_, index) => {
          const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
          
          const dotWidth = scrollX.interpolate({
            inputRange,
            outputRange: [8, 24, 8],
            extrapolate: 'clamp',
          });
          
          const opacity = scrollX.interpolate({
            inputRange,
            outputRange: [0.4, 1, 0.4],
            extrapolate: 'clamp',
          });

          return (
            <Animated.View
              key={index}
              style={[
                styles.paginationDot,
                {
                  width: dotWidth,
                  opacity,
                  backgroundColor: currentSlide === index ? COLORS.primary : COLORS.textSecondary,
                },
              ]}
            />
          );
        })}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      {/* Slides */}
      <Animated.ScrollView
        ref={slideRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false, listener: handleScroll }
        )}
        scrollEventThrottle={16}
        bounces={false}
      >
        {slides.map((item, index) => renderSlide({ item, index }))}
      </Animated.ScrollView>

      {/* Bottom controls */}
      <View style={styles.bottomContainer}>
        {/* Pagination */}
        {renderPagination()}

        {/* Buttons */}
        <View style={styles.buttonContainer}>
          {currentSlide < slides.length - 1 ? (
            <>
              <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
                <Text style={styles.skipButtonText}>Ruka</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
                <LinearGradient
                  colors={[COLORS.primary, COLORS.primaryDark]}
                  style={styles.nextButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.nextButtonText}>Endelea</Text>
                  <Ionicons name="arrow-forward" size={20} color={COLORS.text} />
                </LinearGradient>
              </TouchableOpacity>
            </>
          ) : (
            <Animated.View style={{ transform: [{ scale: pulseAnim }], width: '100%' }}>
              <TouchableOpacity style={styles.startButton} onPress={handleNext}>
                <LinearGradient
                  colors={[COLORS.primary, COLORS.primaryDark]}
                  style={styles.startButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Ionicons name="play-circle" size={24} color={COLORS.text} />
                  <Text style={styles.startButtonText}>Anza Sasa</Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  slide: {
    width,
    height,
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  gradient: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 180,
  },
  contentContainer: {
    paddingHorizontal: SPACING.xl,
    alignItems: 'center',
  },
  logoContainer: {
    marginBottom: SPACING.lg,
  },
  logoWrapper: {
    width: 80,
    height: 80,
    borderRadius: 20,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 12,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  logoGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  crossIcon: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  highlightBadge: {
    backgroundColor: COLORS.primary + '30',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.primary + '50',
  },
  highlightText: {
    color: COLORS.primary,
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: FONT_SIZES.hero,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.sm,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: FONT_SIZES.xl,
    color: COLORS.primary,
    textAlign: 'center',
    marginBottom: SPACING.md,
    fontWeight: '600',
  },
  description: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: SPACING.md,
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.xl + 20,
    paddingTop: SPACING.lg,
    backgroundColor: 'transparent',
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  paginationDot: {
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  skipButton: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  skipButtonText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
  },
  nextButton: {
    borderRadius: BORDER_RADIUS.full,
    overflow: 'hidden',
  },
  nextButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    gap: SPACING.sm,
  },
  nextButtonText: {
    color: COLORS.text,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },
  startButton: {
    borderRadius: BORDER_RADIUS.full,
    overflow: 'hidden',
  },
  startButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    gap: SPACING.sm,
  },
  startButtonText: {
    color: COLORS.text,
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
  },
});

export default OnboardingScreen;
