// @ts-nocheck
// Cord Rogue - main screen. Core logic lives in src/*.js and is
// imported here unchanged. All data is kept in memory on-device.
import { useMemo, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { createUser } from './src/user.js';
import { calculateMV } from './src/mv.js';
import { rankMatches, HAPPINESS_CUTOFF } from './src/matching.js';
import { HAPPINESS_QUESTIONS, scoreHappiness } from './src/questionnaire.js';
import { demoUsers, DEMO_PLACES } from './src/demo.js';
import {
  createAppointment, markArrived, closeAppointment,
  recordDateConsent, dateAgreed,
} from './src/appointment.js';

const FREE_SLOTS = ['2026-12-05T11:00', '2026-12-05T14:00'];

function BigButton({ title, onPress, disabled }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.button, disabled && styles.buttonDisabled]}
    >
      <Text style={styles.buttonText}>{title}</Text>
    </Pressable>
  );
}

export default function App() {
  const [gas, setGas] = useState('80');
  const [cutoff, setCutoff] = useState('50');
  const [station, setStation] = useState('梅田');
  const [answers, setAnswers] = useState(() => HAPPINESS_QUESTIONS.map(() => 3));

  const [me, setMe] = useState(null);
  const [myMV, setMyMV] = useState(null);
  const [matches, setMatches] = useState([]);
  const [calculated, setCalculated] = useState(false);

  const [appt, setAppt] = useState(null);
  const [partnerName, setPartnerName] = useState('');
  const [met, setMet] = useState(false);
  const [consentResult, setConsentResult] = useState('');

  const demos = useMemo(() => demoUsers(), []);

  function handleCalculate() {
    const happiness = scoreHappiness(answers);
    const user = createUser({
      id: 'me',
      displayName: 'あなた',
      gas: Math.min(100, Math.max(50, Number(gas) || 50)),
      gasCutoff: Math.min(100, Math.max(50, Number(cutoff) || 50)),
      nearestStation: station,
      happiness,
    });
    setMe(user);
    setMyMV(calculateMV(user));
    setMatches(rankMatches(user, demos));
    setCalculated(true);
    setAppt(null);
    setMet(false);
    setConsentResult('');
  }

  function startAppointment(partner) {
    const candidates = DEMO_PLACES.map((p, i) => ({
      placeId: p.id,
      rankByA: i,
      rankByB: DEMO_PLACES.length - 1 - i,
    }));
    const created = createAppointment(me.id, partner.id, candidates, FREE_SLOTS, FREE_SLOTS);
    setAppt(created);
    setPartnerName(partner.displayName);
    setMet(false);
    setConsentResult('');
  }

  function handleArrived() {
    if (!appt) return;
    const arrived = markArrived(markArrived(appt, 'A'), 'B');
    const closed = closeAppointment(arrived).appointment;
    setAppt(arrived);
    setMet(closed.status === 'met');
  }

  function handleConsent(otherConsents) {
    if (!appt) return;
    let next = recordDateConsent(appt, 'A', true);
    next = recordDateConsent(next, 'B', otherConsents);
    setAppt(next);
    setConsentResult(
      dateAgreed(next)
        ? '両者合意。デート成立です'
        : '不成立（相手が断りました。相手から連絡先を尋ねられた場合などは規約違反として報告できます）',
    );
  }

  const placeName = appt && appt.placeId
    ? (DEMO_PLACES.find((p) => p.id === appt.placeId) || {}).name
    : '';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Cord Rogue</Text>

      <View style={styles.section}>
        <Text style={styles.heading}>1. 初期設定とスコア測定</Text>
        <Text style={styles.label}>GAS（50〜100）</Text>
        <TextInput style={styles.input} keyboardType="numeric" value={gas} onChangeText={setGas} />
        <Text style={styles.label}>相手に求めるGASの下限</Text>
        <TextInput style={styles.input} keyboardType="numeric" value={cutoff} onChangeText={setCutoff} />
        <Text style={styles.label}>最寄り駅</Text>
        <TextInput style={styles.input} value={station} onChangeText={setStation} />

        <Text style={[styles.label, { marginTop: 12 }]}>幸福度アンケート（各1〜5）</Text>
        {HAPPINESS_QUESTIONS.map((q, qi) => (
          <View key={q} style={styles.question}>
            <Text style={styles.questionText}>{q}</Text>
            <View style={styles.chipRow}>
              {[1, 2, 3, 4, 5].map((v) => (
                <Pressable
                  key={v}
                  style={[styles.chip, answers[qi] === v && styles.chipSelected]}
                  onPress={() => {
                    const next = [...answers];
                    next[qi] = v;
                    setAnswers(next);
                  }}
                >
                  <Text style={answers[qi] === v ? styles.chipTextSelected : styles.chipText}>{v}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ))}

        <BigButton title="MVを計算して相手を探す" onPress={handleCalculate} />
        {calculated && me && (
          me.happiness < HAPPINESS_CUTOFF ? (
            <Text style={styles.result}>
              幸福度 {me.happiness}（足切り {HAPPINESS_CUTOFF} 未満のため、紹介できる相手がいません）
            </Text>
          ) : (
            <Text style={styles.result}>あなたのMV: {myMV}（GAS {me.gas} / 幸福度 {me.happiness}）</Text>
          )
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>2. 相手一覧（MVの近い順）</Text>
        {!calculated && <Text>まだ計算していません</Text>}
        {calculated && matches.length === 0 && <Text>紹介できる相手がいません</Text>}
        {matches.map(({ user, mv, mvDiff }) => (
          <View key={user.id} style={styles.matchRow}>
            <Text style={styles.matchText}>
              {user.displayName}（最寄り: {user.nearestStation}） MV {mv}（差 {mvDiff}）
            </Text>
            <BigButton title="この人とアポイント調整" onPress={() => startAppointment(user)} />
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>3. アポイント調整</Text>
        {!appt && <Text>相手一覧から1人選んでください</Text>}
        {appt && appt.status === 'no_common_slot' && <Text>共通の空き時間がありません</Text>}
        {appt && appt.placeId && (
          <>
            <Text style={styles.matchText}>
              相手: {partnerName}{'\n'}
              日時: {appt.startsAt.replace('T', ' ')}{'\n'}
              場所: {placeName}
            </Text>
            {!met && <BigButton title="両者とも到着した" onPress={handleArrived} />}
            {met && !consentResult && (
              <>
                <Text style={styles.matchText}>対面が成立しました。このままデートに進みますか？</Text>
                <BigButton title="自分: 進む / 相手: 進む" onPress={() => handleConsent(true)} />
                <BigButton title="自分: 進む / 相手: 断る" onPress={() => handleConsent(false)} />
              </>
            )}
            {!!consentResult && <Text style={styles.result}>{consentResult}</Text>}
          </>
        )}
      </View>

      <StatusBar style="auto" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16, paddingTop: 48 },
  title: { fontSize: 26, fontWeight: 'bold', marginBottom: 12 },
  section: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 16 },
  heading: { fontSize: 17, fontWeight: 'bold', marginBottom: 8 },
  label: { marginTop: 8, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#999', borderRadius: 6, padding: 8 },
  question: { marginTop: 8 },
  questionText: { marginBottom: 4 },
  chipRow: { flexDirection: 'row', gap: 6 },
  chip: { borderWidth: 1, borderColor: '#999', borderRadius: 16, paddingVertical: 4, paddingHorizontal: 12 },
  chipSelected: { backgroundColor: '#333', borderColor: '#333' },
  chipText: { color: '#333' },
  chipTextSelected: { color: '#fff' },
  button: { backgroundColor: '#333', borderRadius: 8, padding: 12, marginTop: 10, alignItems: 'center' },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: '#fff', fontWeight: 'bold' },
  result: { fontSize: 16, fontWeight: 'bold', marginTop: 12 },
  matchRow: { borderTopWidth: 1, borderTopColor: '#eee', paddingVertical: 8 },
  matchText: { fontSize: 15, lineHeight: 22 },
});
