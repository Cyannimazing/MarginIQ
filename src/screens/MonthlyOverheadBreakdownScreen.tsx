import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/types';
import { useProductStore } from '../stores/productStore';
import { useSettingsStore } from '../stores/settingsStore';
import { formatMoney } from '../utils/currency';
import {
  OverheadLineItem,
  parseOverheadLinesJson,
  stringifyOverheadLines,
  sumOverheadLines,
  computeOverheadTotal,
} from '../utils/overheadLines';
import { FormSection } from '../components/ui/FormSection';
import { ActionModal } from '../components/ui/ActionModal';

type Props = NativeStackScreenProps<RootStackParamList, 'MonthlyOverheadBreakdown'>;

const newLineId = () => `oh-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export function MonthlyOverheadBreakdownScreen({ route, navigation }: Props) {
  const { target, productId, costGroupId } = route.params;
  const products = useProductStore((s) => s.products);
  const costGroups = useProductStore((s) => s.costGroups);
  const loadProducts = useProductStore((s) => s.loadProducts);
  const editProduct = useProductStore((s) => s.editProduct);
  const editCostGroup = useProductStore((s) => s.editCostGroup);

  const currencyCode = useSettingsStore((s) => s.settings.currencyCode);

  const rawJson = useMemo(() => {
    if (target === 'product' && productId != null) {
      const p = products.find((x) => x.id === productId);
      return (p as any)?.monthlyOverheadBreakdown as string | undefined;
    }
    if (target === 'costGroup' && costGroupId != null) {
      const g = costGroups.find((x) => x.id === costGroupId);
      return (g as any)?.monthlySharedCostBreakdown as string | undefined;
    }
    return undefined;
  }, [target, productId, costGroupId, products, costGroups]);

  const overheadTotal = useMemo(() => {
    if (target === 'product' && productId != null) {
      const p = products.find((x) => x.id === productId);
      return Math.max(Number((p as any)?.monthlyOverhead) || 0, 0);
    }
    if (target === 'costGroup' && costGroupId != null) {
      const g = costGroups.find((x) => x.id === costGroupId);
      return Math.max(Number((g as any)?.monthlySharedCost) || 0, 0);
    }
    return 0;
  }, [target, productId, costGroupId, products, costGroups]);

  const adaptLinesForExistingTotal = useCallback((lines: OverheadLineItem[], contingencyPct: number) => {
    if (overheadTotal > 0 && lines.length === 1 && Number(lines[0].amount) === 0) {
      const label = (lines[0].label || '').trim() || 'Expense';
      const divisor = 1 + (Math.max(0, Math.min(100, contingencyPct)) / 100);
      const subtotal = overheadTotal / divisor;
      return [{ ...lines[0], label, amount: subtotal }];
    }
    return lines;
  }, [overheadTotal]);

  const [lines, setLines] = useState<OverheadLineItem[]>(() => {
    const parsed = parseOverheadLinesJson(rawJson);
    return adaptLinesForExistingTotal(parsed.lines, parsed.contingencyPct);
  });
  const [contingencyPct, setContingencyPct] = useState<number>(() => {
    return parseOverheadLinesJson(rawJson).contingencyPct;
  });
  const [contingencyText, setContingencyText] = useState<string>(() => {
    const pct = parseOverheadLinesJson(rawJson).contingencyPct;
    return pct === 0 ? '' : String(pct);
  });

  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState<{ visible: boolean; title: string; message: string; isError?: boolean }>({
    visible: false,
    title: '',
    message: '',
  });

  useFocusEffect(
    useCallback(() => {
      void loadProducts();
    }, [loadProducts]),
  );

  useEffect(() => {
    const parsed = parseOverheadLinesJson(rawJson);
    setLines(adaptLinesForExistingTotal(parsed.lines, parsed.contingencyPct));
    setContingencyPct(parsed.contingencyPct);
    setContingencyText(parsed.contingencyPct === 0 ? '' : String(parsed.contingencyPct));
  }, [rawJson, adaptLinesForExistingTotal]);

  const subtotal = useMemo(() => sumOverheadLines(lines), [lines]);
  const contingencyAmount = useMemo(() => subtotal * (contingencyPct / 100), [subtotal, contingencyPct]);
  const total = subtotal + contingencyAmount;

  const titleHint =
    target === 'product'
      ? "This product's extra monthly overhead"
      : 'Shared monthly overhead for this product group';

  const updateLine = useCallback((id: string, patch: Partial<OverheadLineItem>) => {
    setLines((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }, []);

  const removeLine = useCallback((id: string) => {
    setLines((prev) => {
      const next = prev.filter((r) => r.id !== id);
      return next.length ? next : [{ id: newLineId(), label: '', amount: 0 }];
    });
  }, []);

  const addLine = useCallback(() => {
    setLines((prev) => [...prev, { id: newLineId(), label: '', amount: 0 }]);
  }, []);

  const handleSave = async () => {
    const sanitized = lines.map((row) => ({
      id: row.id || newLineId(),
      label: row.label.trim() || 'Expense',
      amount: Math.max(0, Number(row.amount) || 0),
    }));
    const data = { lines: sanitized, contingencyPct };
    const sum = computeOverheadTotal(data);
    const json = stringifyOverheadLines(data);
    setSaving(true);
    try {
      if (target === 'product' && productId != null) {
        await editProduct(productId, {
          monthlyOverhead: sum,
          monthlyOverheadBreakdown: json,
        });
      } else if (target === 'costGroup' && costGroupId != null) {
        await editCostGroup(costGroupId, {
          monthlySharedCost: sum,
          monthlySharedCostBreakdown: json,
        });
      }
      await loadProducts();
      navigation.goBack();
    } catch {
      setModal({ visible: true, title: 'Save failed', message: 'Could not save. Try again.', isError: true });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#ffffff' }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={{ flex: 1, paddingHorizontal: 20 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 120 }}>
          <View style={{ height: 12 }} />
          <Text style={{ fontSize: 13, color: '#14532d', fontWeight: '600', lineHeight: 20, marginBottom: 24, paddingHorizontal: 4 }}>
            {titleHint}
          </Text>
          <Text style={{ fontSize: 10, color: '#14532d', marginBottom: 16, paddingHorizontal: 4, opacity: 0.6 }}>
            Enter each monthly bill or allocation. The total updates the amount shown on the dashboard and in product analysis.
          </Text>

          <FormSection title="Expense lines" icon="list">
            {lines.map((row, index) => (
              <View
                key={row.id}
                style={[
                  { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
                  index > 0 ? { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#f0fdf4' } : {},
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 9, fontWeight: '900', color: '#14532d', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4, opacity: 0.6 }}>Label</Text>
                  <TextInput
                    value={row.label}
                    onChangeText={(t) => updateLine(row.id, { label: t })}
                    placeholder="Rent, electricity…"
                    placeholderTextColor="#94a3b8"
                    style={{ borderRadius: 16, borderWidth: 1, borderColor: '#dcfce7', backgroundColor: '#f0fdf4', paddingHorizontal: 16, paddingVertical: 12, fontSize: 14, fontWeight: '700', color: '#14532d' }}
                  />
                </View>
                <View style={{ width: 100 }}>
                  <Text style={{ fontSize: 9, fontWeight: '900', color: '#14532d', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4, opacity: 0.6 }}>Amount</Text>
                  <TextInput
                    value={row.amount === 0 ? '' : String(row.amount)}
                    onChangeText={(t) => {
                      const n = parseFloat(t.replace(/,/g, ''));
                      updateLine(row.id, { amount: Number.isFinite(n) ? Math.max(0, n) : 0 });
                    }}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor="#94a3b8"
                    style={{ borderRadius: 16, borderWidth: 1, borderColor: '#dcfce7', backgroundColor: '#f0fdf4', paddingHorizontal: 12, paddingVertical: 12, fontSize: 14, fontWeight: '900', color: '#14532d' }}
                  />
                </View>
                <Pressable onPress={() => removeLine(row.id)} style={{ marginTop: 24, padding: 8 }} hitSlop={12}>
                  <Ionicons name="trash-outline" size={20} color="#ef4444" />
                </Pressable>
              </View>
            ))}

            <Pressable onPress={addLine} style={{ marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start' }}>
              <Ionicons name="add-circle" size={22} color="#14532d" />
              <Text style={{ fontSize: 14, fontWeight: '900', color: '#14532d' }}>Add line</Text>
            </Pressable>
          </FormSection>

          {/* Contingency Buffer */}
          <View style={{ marginTop: 24, borderRadius: 24, borderWidth: 1, borderColor: '#dcfce7', backgroundColor: '#f0fdf4', paddingHorizontal: 20, paddingVertical: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Ionicons name="shield-checkmark-outline" size={16} color="#14532d" />
              <Text style={{ fontSize: 10, fontWeight: '900', color: '#14532d', textTransform: 'uppercase', letterSpacing: 2 }}>Contingency Buffer</Text>
            </View>
            <Text style={{ fontSize: 10, color: '#14532d', marginBottom: 16, lineHeight: 16, opacity: 0.6 }}>
              A buffer for unexpected or emergency costs. Added on top of your expense subtotal.
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: 1, borderColor: '#dcfce7', backgroundColor: '#ffffff', paddingHorizontal: 16, paddingVertical: 12 }}>
                <TextInput
                  value={contingencyText}
                  onChangeText={(v) => {
                    setContingencyText(v);
                    const n = parseFloat(v);
                    setContingencyPct(isFinite(n) ? Math.min(100, Math.max(0, n)) : 0);
                  }}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor="#94a3b8"
                  style={{ flex: 1, fontSize: 14, fontWeight: '900', color: '#14532d' }}
                />
                <Text style={{ fontSize: 14, fontWeight: '900', color: '#14532d', opacity: 0.5 }}>%</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 9, fontWeight: '700', color: '#14532d', textTransform: 'uppercase', letterSpacing: 2, opacity: 0.5, marginBottom: 2 }}>= Amount</Text>
                <Text style={{ fontSize: 16, fontWeight: '900', color: '#14532d' }}>
                  {formatMoney(contingencyAmount, currencyCode)}
                </Text>
              </View>
            </View>
          </View>

          {/* Summary Card */}
          <View style={{ marginTop: 24, borderRadius: 24, backgroundColor: '#14532d', paddingHorizontal: 20, paddingVertical: 16 }}>
            {contingencyPct > 0 && (
              <>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={{ fontSize: 9, fontWeight: '700', color: '#bbf7d0', textTransform: 'uppercase', letterSpacing: 2 }}>Subtotal</Text>
                  <Text style={{ fontSize: 11, fontWeight: '900', color: '#bbf7d0' }}>{formatMoney(subtotal, currencyCode)}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#166534' }}>
                  <Text style={{ fontSize: 9, fontWeight: '700', color: '#bbf7d0', textTransform: 'uppercase', letterSpacing: 2 }}>+ Contingency ({contingencyPct}%)</Text>
                  <Text style={{ fontSize: 11, fontWeight: '900', color: '#bbf7d0' }}>+ {formatMoney(contingencyAmount, currencyCode)}</Text>
                </View>
              </>
            )}
            <Text style={{ fontSize: 9, fontWeight: '900', color: '#86efac', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4 }}>Saves as monthly total</Text>
            <Text style={{ fontSize: 28, fontWeight: '900', color: '#ffffff' }}>{formatMoney(total, currencyCode)}</Text>
          </View>

          <Pressable onPress={handleSave} disabled={saving} style={{ marginTop: 32, marginBottom: 16 }}>
            <View style={{ height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 28, backgroundColor: '#14532d', opacity: saving ? 0.7 : 1 }}>
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ fontWeight: '900', color: '#ffffff', fontSize: 13, textTransform: 'uppercase', letterSpacing: 2 }}>Save & apply total</Text>
              )}
            </View>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <ActionModal
        visible={modal.visible}
        title={modal.title}
        message={modal.message}
        primaryActionText="OK"
        onPrimaryAction={() => setModal((s) => ({ ...s, visible: false }))}
      />
    </View>
  );
}
