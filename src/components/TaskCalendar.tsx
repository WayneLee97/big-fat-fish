import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { TaskOccurrence } from '@/data/task';
import { dateKey, movePeriod, needsManualReminder, periodDays } from '@/services/calendar/calendarView';
import { TaskCard } from './TaskCard';

export type CalendarMode = 'week' | 'month';
export function TaskCalendar({ tasks, mode, selected, onSelect, onOpen, onComplete }: {
  tasks: TaskOccurrence[]; mode: CalendarMode; selected: Date; onSelect: (date: Date) => void;
  onOpen: (task: TaskOccurrence) => void; onComplete: (task: TaskOccurrence) => void;
}) {
  const scroll = useRef<ScrollView>(null);
  const offsets = useRef<Record<string, number>>({});
  const [today, setToday] = useState(() => new Date());
  useEffect(() => {
    const refresh = () => setToday(new Date());
    const timer = setInterval(refresh, 60_000);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    return () => { clearInterval(timer); subscription.remove(); };
  }, []);
  const days = useMemo(() => periodDays(selected, mode), [selected, mode]);
  const groups = useMemo(() => {
    const result = new Map<string, TaskOccurrence[]>();
    for (const task of tasks.filter(item => item.status === 'active').sort((a, b) => a.eventAt - b.eventAt)) {
      result.set(task.eventDate, [...(result.get(task.eventDate) ?? []), task]);
    }
    return result;
  }, [tasks]);
  const periodKey = `${mode}-${dateKey(days[0])}`;
  useEffect(() => { scroll.current?.scrollTo({ y: 0, animated: false }); }, [periodKey]);
  const chooseDay = (date: Date) => {
    onSelect(date);
    const y = offsets.current[dateKey(date)];
    if (y != null) scroll.current?.scrollTo({ y, animated: true });
  };
  const marked = (task: TaskOccurrence) => needsManualReminder(task, today);
  const label = mode === 'month' ? `${selected.getFullYear()}年${selected.getMonth() + 1}月` : `${days[0].getMonth() + 1}月${days[0].getDate()}日 — ${days[6].getMonth() + 1}月${days[6].getDate()}日`;
  const blankCount = mode === 'month' ? (days[0].getDay() + 6) % 7 : 0;
  return <ScrollView ref={scroll} contentContainerStyle={s.content}>
    <View style={s.navigation}>
      <Pressable accessibilityLabel={mode === 'month' ? '上个月' : '上一周'} hitSlop={8} onPress={() => onSelect(movePeriod(selected, mode, -1))}><Text style={s.arrow}>‹</Text></Pressable>
      <Text style={s.heading}>{label}</Text>
      <Pressable accessibilityLabel={mode === 'month' ? '下个月' : '下一周'} hitSlop={8} onPress={() => onSelect(movePeriod(selected, mode, 1))}><Text style={s.arrow}>›</Text></Pressable>
    </View>
    <Pressable style={s.returnButton} onPress={() => { onSelect(new Date()); scroll.current?.scrollTo({ y: 0, animated: true }); }}><Text style={s.link}>{mode === 'month' ? '回到本月' : '回到本周'}</Text></Pressable>
    <View style={s.grid}>
      {['一', '二', '三', '四', '五', '六', '日'].map(day => <Text key={day} style={s.weekday}>{day}</Text>)}
      {Array.from({ length: blankCount }, (_, i) => <View key={`blank-${i}`} style={s.cell} />)}
      {days.map(day => {
        const key = dateKey(day); const items = groups.get(key) ?? []; const active = key === dateKey(selected);
        return <View key={key} style={[s.cell, mode === 'month' && s.monthCell, active && s.selected]}>
          <Pressable accessibilityRole="button" accessibilityLabel={`${key}，${items.length}项日程`} accessibilityState={{ selected: active }} style={s.dayButton} onPress={() => chooseDay(day)}>
            <Text style={[s.day, key === dateKey(today) && s.today]}>{day.getDate()}</Text>
            {items.some(marked) && <View accessibilityLabel="本周手动新增事项" style={s.dot} />}
          </Pressable>
          {mode === 'month' && items.slice(0, 2).map(task => <Pressable key={task.id} accessibilityRole="button" accessibilityLabel={`查看详情：${task.content}`} style={s.event} onPress={() => onOpen(task)}>
            {marked(task) && <View style={s.dot} />}<Text numberOfLines={1} style={[s.eventText, task.completed && s.completed]}>{task.content}</Text>
          </Pressable>)}
          {mode === 'month' && items.length > 2 && <Pressable onPress={() => chooseDay(day)} style={s.more}><Text style={s.moreText}>+{items.length - 2}项</Text></Pressable>}
        </View>;
      })}
    </View>
    <Text style={s.legend}>🔴 本周手动新增且未完成的事项</Text>
    <Text style={s.heading}>{mode === 'month' ? '整月事项' : '本周事项'}</Text>
    {days.map(day => {
      const key = dateKey(day); const items = groups.get(key) ?? [];
      return <View key={`${periodKey}-${key}`} onLayout={event => { offsets.current[key] = event.nativeEvent.layout.y; }}>
        <View style={[s.dateHeader, key === dateKey(selected) && s.selected]}>
          <Text style={s.dateTitle}>{day.getMonth() + 1}月{day.getDate()}日 · 周{['日', '一', '二', '三', '四', '五', '六'][day.getDay()]}</Text>
          {items.some(marked) && <View style={s.dot} />}<Text style={s.count}>{items.length}项</Text>
        </View>
        {items.length ? items.map(task => <TaskCard key={task.id} task={task} highlighted={marked(task)} onPress={() => onOpen(task)} onComplete={() => onComplete(task)} />) : <Text style={s.empty}>当天暂无日程</Text>}
      </View>;
    })}
  </ScrollView>;
}

const s = StyleSheet.create({
  content: { padding: 16, paddingBottom: 150, gap: 12 },
  navigation: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  arrow: { fontSize: 32, color: '#4aa488', paddingHorizontal: 12 },
  heading: { color: '#263c36', fontSize: 18, fontWeight: '700' },
  returnButton: { alignSelf: 'center', padding: 8 }, link: { color: '#4aa488', fontSize: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden' },
  weekday: { width: '14.285714%', textAlign: 'center', paddingVertical: 10, color: '#789087', fontSize: 12 },
  cell: { width: '14.285714%', padding: 2, borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#e0ebe5' },
  monthCell: { minHeight: 112 }, selected: { backgroundColor: '#dff3e9', borderRadius: 8 },
  dayButton: { minHeight: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 },
  day: { fontSize: 14, color: '#40574f' }, today: { color: '#208167', fontWeight: '900', textDecorationLine: 'underline' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#df5454' },
  event: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 5, paddingHorizontal: 2, backgroundColor: '#edf6f1', borderRadius: 4, marginBottom: 2 },
  eventText: { flex: 1, fontSize: 10, color: '#31594b' }, completed: { color: '#91a59d', textDecorationLine: 'line-through' },
  more: { paddingVertical: 5 }, moreText: { fontSize: 10, color: '#4aa488', textAlign: 'center' },
  legend: { fontSize: 11, color: '#91a39a' },
  dateHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, marginBottom: 8 },
  dateTitle: { color: '#40574f', fontWeight: '700' }, count: { marginLeft: 'auto', fontSize: 12, color: '#91a39a' },
  empty: { color: '#91a39a', fontSize: 13, paddingHorizontal: 12, paddingBottom: 12 },
});
