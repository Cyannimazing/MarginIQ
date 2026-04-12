import React, { useCallback, useMemo, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RootStackParamList } from '../navigation/types';
import { useSettingsStore } from '../stores/settingsStore';
import { useUIStore } from '../stores/uiStore';

type Props = NativeStackScreenProps<RootStackParamList, 'HelpSupport'>;

type HelpDoc = {
  id: string;
  title: string;
  summary: string;
  steps: string[];
};

type Tutorial = {
  id: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
  steps: string[];
};

const docs: HelpDoc[] = [
  {
    id: 'group-overhead',
    title: 'Set Group Monthly Overhead',
    summary: 'Assign monthly shared costs to a product group so costs are distributed fairly.',
    steps: [
      'Make sure you have 2 or more products in your product list.',
      'Tap the plus button and choose Create Group.',
      'Select the products to include, then enter a group name and save.',
      'After the group is created, tap Setup Monthly Overhead below that group.',
      'Enter the shared monthly overhead amount and save.',
    ],
  },
  {
    id: 'monthly-overhead',
    title: 'Set Up Monthly Overhead',
    summary: 'Track recurring business expenses and include them in your pricing context.',
    steps: [
      'From product list, tap a specific product.',
      'Tap Setup Monthly Overhead for that product.',
      'In the first input, add labels like rent overhead monthly, labor, utilities, internet, etc.',
      'Add monthly amount per line, then set contingency as a buffer for unexpected costs.',
      'Tap Save & apply total.',
    ],
  },
  {
    id: 'add-resources',
    title: 'Add Resources to Library',
    summary: 'Build your ingredient and packaging library so you can compose product costs accurately.',
    steps: [
      'Open the side menu and tap Library.',
      'Tap the plus button to add a new resource.',
      'Enter the resource name, unit, quantity, and price per unit.',
      'Choose a tag (Raw Material or Packaging) and tap Register Resource.',
      'Repeat for all ingredients and packaging materials you use.',
    ],
  },
  {
    id: 'log-sales',
    title: 'Log Your Sales',
    summary: 'Record sold, discounted, and unsold units to track actual revenue and profit.',
    steps: [
      'Long press any product card on the dashboard.',
      'Tap the actions button and select Log Sales.',
      'Enter how many units were sold, discounted, and unsold.',
      'Review the auto-computed revenue and profit summary.',
      'Tap Log Sales Data to save the entry.',
    ],
  },
  {
    id: 'monthly-goals',
    title: 'Set Monthly Goals',
    summary: 'Define target monthly profit to measure sales and pricing performance.',
    steps: [
      'Tap any product from the product list.',
      'In Product Analysis, open the Monthly Goal Progress card.',
      'Enter your monthly goal and tap Save.',
      'Track your progress from the same Monthly Goal section.',
    ],
  },
];

const tutorials: Tutorial[] = [
  {
    id: 't-product',
    title: 'Create Product Walkthrough',
    subtitle: 'Step-by-step guide to adding and pricing a new product.',
    icon: 'cube',
    accent: '#14532d',
    steps: [
      'Tap the green plus button and select Add Product.',
      'Enter the product name and choose a category.',
      'Select whether it is a direct purchase or composed from ingredients.',
      'For composed products, compose your resources and specify quantities.',
      'Set VAT and discounts if necessary, then save.',
    ],
  },
  {
    id: 't-overhead-group',
    title: 'Group Overhead Walkthrough',
    subtitle: 'Configure shared monthly costs for grouped products.',
    icon: 'layers',
    accent: '#14532d',
    steps: [
      'Make sure you have at least 2 products in your list.',
      'Tap the plus button and select Create Group.',
      'Choose which products to group, then input a group name and save.',
      'Tap Setup Monthly Overhead under that group.',
      'Enter monthly overhead and save to apply the shared cost.',
    ],
  },
  {
    id: 't-overhead-monthly',
    title: 'Monthly Overhead Walkthrough',
    subtitle: 'Set monthly overhead for a specific product from the dashboard list.',
    icon: 'receipt',
    accent: '#0f766e',
    steps: [
      'Tap any product in your list to open Product Analysis.',
      'Tap Setup Monthly Overhead for that product.',
      'Add line labels like rent monthly, labor, utilities, and enter monthly amount per line.',
      'Set contingency as an extra emergency buffer, then save.',
    ],
  },
  {
    id: 't-resources',
    title: 'Add Resources Walkthrough',
    subtitle: 'Add ingredients, packaging, and other resources without compose mode.',
    icon: 'leaf',
    accent: '#166534',
    steps: [
      'Open Resources Library.',
      'Tap the plus button to add a new resource.',
      'Enter name, quantity, price, and select the right tag.',
      'Tap Register Resource to save.',
    ],
  },
  {
    id: 't-sales',
    title: 'Log Sales Walkthrough',
    subtitle: 'Long press a product, open actions, and log a sale entry.',
    icon: 'stats-chart',
    accent: '#0f766e',
    steps: [
      'Long press a product card, open actions, then tap Log Sales.',
      'Enter sold, discounted, and unsold counts.',
      'Tap Log Sales Data to save the sale.',
    ],
  },
  {
    id: 't-goals',
    title: 'Monthly Goal Walkthrough',
    subtitle: 'Set pricing strategy and profit goals for each product.',
    icon: 'trending-up',
    accent: '#1d4ed8',
    steps: [
      'Tap any product in your list to open Product Analysis.',
      'Tap Monthly Goal Progress to expand it.',
      'Input your monthly goal, then tap Save.',
      'Review progress percent and remaining target in the same card.',
    ],
  },
];

export function HelpSupportScreen({ navigation }: Props) {
  const [tab, setTab] = useState<'docs' | 'tutorials'>('docs');
  const [activeTutorialId, setActiveTutorialId] = useState<string | null>(null);
  const saveSettings = useSettingsStore((state) => state.saveSettings);
  const setViewMode = useUIStore((state) => state.setViewMode);

  const activeTutorial = useMemo(
    () => tutorials.find((t) => t.id === activeTutorialId) ?? null,
    [activeTutorialId],
  );

  React.useLayoutEffect(() => {
    navigation.setOptions({ title: 'Help Center' });
  }, [navigation]);

  const handleStartTutorial = useCallback(async (_tutorialId: string) => {
    setViewMode('active');
    await saveSettings({ tutorialStep: 1, tutorialGuideTopic: _tutorialId });
    navigation.navigate('Dashboard');
  }, [navigation, saveSettings, setViewMode]);

  return (
    <SafeAreaView style={s.root} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>
        <View style={s.headerCard}>
          <Text style={s.headerLabel}>Knowledge Center</Text>
          <Text style={s.headerTitle}>Documentation + Guided Tutorials</Text>
          <Text style={s.headerSubtext}>
            Learn core workflows quickly and train your team with repeatable, step-by-step guides.
          </Text>
        </View>

        <View style={s.tabShell}>
          <Pressable onPress={() => setTab('docs')} style={[s.tabBtn, tab === 'docs' && s.tabBtnActive]}>
            <Ionicons name="document-text" size={14} color={tab === 'docs' ? '#ffffff' : '#14532d'} />
            <Text style={[s.tabText, tab === 'docs' && s.tabTextActive]}>Documentation</Text>
          </Pressable>
          <Pressable onPress={() => setTab('tutorials')} style={[s.tabBtn, tab === 'tutorials' && s.tabBtnActive]}>
            <Ionicons name="play-circle" size={14} color={tab === 'tutorials' ? '#ffffff' : '#14532d'} />
            <Text style={[s.tabText, tab === 'tutorials' && s.tabTextActive]}>Tutorials</Text>
          </Pressable>
        </View>

        {tab === 'docs' ? (
          <View style={s.stack}>
            {docs.map((item) => (
              <View key={item.id} style={s.docCard}>
                <Text style={s.docTitle}>{item.title}</Text>
                <Text style={s.docSummary}>{item.summary}</Text>
                <View style={s.docStepsWrap}>
                  {item.steps.map((step, idx) => (
                    <Text key={`${item.id}-${idx}`} style={s.stepText}>
                      {idx + 1}. {step}
                    </Text>
                  ))}
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={s.stack}>
            {tutorials.map((item) => (
              <Pressable key={item.id} onPress={() => void handleStartTutorial(item.id)}>
                <View style={s.tutorialCard}>
                  <View style={[s.tutorialCoachBar, { backgroundColor: item.accent }]}>
                    <View style={s.tutorialAvatarWrap}>
                      <Image
                        source={require('../../assets/tutorial_character.png')}
                        style={s.tutorialAvatar}
                        resizeMode="cover"
                      />
                    </View>
                    <View style={s.tutorialSpeech}>
                      <Text style={s.tutorialSpeechText}>Hey there again. I can guide you through this one.</Text>
                    </View>
                  </View>
                  <View style={s.tutorialBody}>
                    <Text style={s.tutorialTitle}>{item.title}</Text>
                    <Text style={s.tutorialSubtitle}>{item.subtitle}</Text>
                    <Text style={s.ctaText}>Tap to start guided walkthrough</Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      <Modal
        transparent
        visible={!!activeTutorial}
        animationType="fade"
        onRequestClose={() => setActiveTutorialId(null)}
      >
        <View style={s.modalBackdrop}>
          <View style={s.modalCard}>
            {activeTutorial && (
              <>
                <View style={[s.modalCoachHeader, { backgroundColor: activeTutorial.accent }]}>
                  <View style={s.modalAvatarWrap}>
                    <Image
                      source={require('../../assets/tutorial_character.png')}
                      style={s.modalAvatar}
                      resizeMode="cover"
                    />
                  </View>
                  <View style={s.modalCoachSpeech}>
                    <Text style={s.modalCoachSpeechText}>Hey there again. Let's do this together, step by step.</Text>
                  </View>
                </View>

                <View style={s.modalContent}>
                  <View style={s.modalTitleRow}>
                    <Ionicons name={activeTutorial.icon} size={16} color={activeTutorial.accent} />
                    <Text style={s.modalTitleText}>{activeTutorial.title}</Text>
                  </View>
                  <Text style={s.modalSubtitle}>{activeTutorial.subtitle}</Text>
                  {activeTutorial.steps.map((step, idx) => (
                    <Text key={`${activeTutorial.id}-modal-${idx}`} style={s.modalStep}>
                      {idx + 1}. {step}
                    </Text>
                  ))}

                  <View style={s.modalTipBox}>
                    <Text style={s.modalTipText}>
                      Hey there again. Follow these steps in order, and your setup will stay clean and consistent.
                    </Text>
                  </View>

                  <Pressable onPress={() => setActiveTutorialId(null)} style={s.modalButton}>
                    <Text style={s.modalButtonText}>Got it</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#ffffff' },
  container: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 28 },
  headerCard: {
    backgroundColor: '#14532d',
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 16,
    marginBottom: 14,
  },
  headerLabel: {
    color: '#86efac',
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 4,
  },
  headerTitle: { color: '#ffffff', fontSize: 19, fontWeight: '900', marginBottom: 4 },
  headerSubtext: { color: '#dcfce7', fontSize: 12, fontWeight: '600', lineHeight: 18 },
  tabShell: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    padding: 4,
    marginBottom: 14,
    gap: 6,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    textTransform: 'uppercase',
    borderRadius: 12,
    height: 40,
  },
  tabBtnActive: { backgroundColor: '#14532d' },
  tabText: { color: '#14532d', fontSize: 12, fontWeight: '800' },
  tabTextActive: { color: '#ffffff' },
  stack: { gap: 10 },
  docCard: {
    borderWidth: 1,
    borderColor: '#dcfce7',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: '#f0fdf4',
  },
  docTitle: { fontSize: 14, fontWeight: '900', color: '#14532d', marginBottom: 4 },
  docSummary: { fontSize: 12, fontWeight: '600', color: '#64748b', marginBottom: 10, lineHeight: 18 },
  docStepsWrap: { gap: 5 },
  stepText: { fontSize: 11, color: '#1e293b', fontWeight: '700', lineHeight: 16 },
  tutorialCard: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  tutorialCoachBar: {
    minHeight: 88,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tutorialAvatarWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#ffffff',
    backgroundColor: '#dcfce7',
    flexShrink: 0,
  },
  tutorialAvatar: {
    width: '100%',
    height: '100%',
  },
  tutorialSpeech: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  tutorialSpeechText: {
    color: '#14532d',
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 16,
  },
  tutorialBody: { paddingHorizontal: 14, paddingVertical: 12 },
  tutorialTitle: { color: '#0f172a', fontSize: 14, fontWeight: '900', marginBottom: 4 },
  tutorialSubtitle: { color: '#64748b', fontSize: 12, fontWeight: '600', lineHeight: 18, marginBottom: 6 },
  ctaText: { color: '#14532d', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
  },
  modalCoachHeader: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modalAvatarWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#ffffff',
    backgroundColor: '#dcfce7',
  },
  modalAvatar: {
    width: '100%',
    height: '100%',
  },
  modalCoachSpeech: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  modalCoachSpeechText: {
    color: '#14532d',
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 16,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  modalTitleText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '900',
  },
  modalContent: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16 },
  modalSubtitle: { color: '#64748b', fontSize: 12, fontWeight: '600', lineHeight: 18, marginBottom: 10 },
  modalStep: { color: '#0f172a', fontSize: 12, fontWeight: '700', lineHeight: 18, marginBottom: 4 },
  modalTipBox: {
    marginTop: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dcfce7',
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  modalTipText: { color: '#14532d', fontSize: 11, fontWeight: '700', lineHeight: 16 },
  modalButton: {
    marginTop: 12,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#14532d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
