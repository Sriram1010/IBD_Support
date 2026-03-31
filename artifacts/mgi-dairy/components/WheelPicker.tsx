import React, { useRef, useState, useEffect } from "react";
import { ScrollView, View, Text, Platform, TextInput, TouchableOpacity } from "react-native";

const ITEM_HEIGHT = 46;
const VISIBLE = 5;

interface WheelPickerProps {
  items: string[];
  initialIndex?: number;
  onChange: (index: number, value: string) => void;
  width?: number;
  colors: {
    text: string;
    textSecondary: string;
    teal: string;
    tealLight: string;
    surface: string;
  };
}

export function WheelPicker({
  items,
  initialIndex = 0,
  onChange,
  width = 72,
  colors,
}: WheelPickerProps) {
  const scrollRef = useRef<ScrollView>(null);
  const [selIdx, setSelIdx] = useState(initialIndex);
  const mounted = useRef(false);

  useEffect(() => {
    setSelIdx(initialIndex);
  }, [initialIndex]);

  const handleContentSizeChange = () => {
    if (!mounted.current) {
      scrollRef.current?.scrollTo({ y: initialIndex * ITEM_HEIGHT, animated: false });
      mounted.current = true;
    }
  };

  const snapAndNotify = (y: number) => {
    const idx = Math.max(0, Math.min(items.length - 1, Math.round(y / ITEM_HEIGHT)));
    setSelIdx(idx);
    onChange(idx, items[idx]);
    scrollRef.current?.scrollTo({ y: idx * ITEM_HEIGHT, animated: false });
  };

  const handleScroll = (e: any) => {
    const y = e.nativeEvent.contentOffset.y;
    const idx = Math.max(0, Math.min(items.length - 1, Math.round(y / ITEM_HEIGHT)));
    if (idx !== selIdx) setSelIdx(idx);
  };

  return (
    <View style={{ width, height: ITEM_HEIGHT * VISIBLE, overflow: "hidden" }}>
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: ITEM_HEIGHT * 2,
          height: ITEM_HEIGHT,
          left: 2,
          right: 2,
          backgroundColor: colors.tealLight,
          borderRadius: 10,
          borderWidth: 1.5,
          borderColor: colors.teal,
        }}
      />
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        contentContainerStyle={{
          paddingTop: ITEM_HEIGHT * 2,
          paddingBottom: ITEM_HEIGHT * 2,
        }}
        onContentSizeChange={handleContentSizeChange}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(e) => snapAndNotify(e.nativeEvent.contentOffset.y)}
        onScrollEndDrag={(e) => snapAndNotify(e.nativeEvent.contentOffset.y)}
      >
        {items.map((item, idx) => {
          const dist = Math.abs(idx - selIdx);
          return (
            <View
              key={`${item}-${idx}`}
              style={{ height: ITEM_HEIGHT, justifyContent: "center", alignItems: "center" }}
            >
              <Text
                style={{
                  fontSize: dist === 0 ? 22 : dist === 1 ? 17 : 14,
                  fontWeight: dist === 0 ? "700" : "400",
                  color: dist === 0 ? colors.text : colors.textSecondary,
                  opacity: dist === 0 ? 1 : dist === 1 ? 0.6 : 0.3,
                }}
              >
                {item}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const HOURS_12 = ["1","2","3","4","5","6","7","8","9","10","11","12"];
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));
const AMPM = ["AM", "PM"];

export function parse24h(time: string): { h12: number; min: number; ampm: "AM" | "PM" } {
  const parts = time.split(":");
  const h = parseInt(parts[0] ?? "0", 10) || 0;
  const m = parseInt(parts[1] ?? "0", 10) || 0;
  const ampm: "AM" | "PM" = h < 12 ? "AM" : "PM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return { h12, min: m, ampm };
}

export function to24h(h12: number, min: number, ampm: "AM" | "PM"): string {
  let h = h12;
  if (ampm === "AM" && h12 === 12) h = 0;
  if (ampm === "PM" && h12 !== 12) h = h12 + 12;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

interface TimePickerProps {
  value: string;
  onChange: (time24h: string) => void;
  colors: any;
}

export function TimePicker({ value, onChange, colors }: TimePickerProps) {
  const { h12, min, ampm } = parse24h(value);
  const hIdx = HOURS_12.indexOf(String(h12));
  const mIdx = min;
  const aIdx = ampm === "AM" ? 0 : 1;

  const [curH, setCurH] = useState(h12);
  const [curM, setCurM] = useState(min);
  const [curA, setCurA] = useState(ampm);

  const emit = (h: number, m: number, a: "AM" | "PM") => {
    onChange(to24h(h, m, a));
  };

  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 }}>
      <WheelPicker
        items={HOURS_12}
        initialIndex={hIdx >= 0 ? hIdx : 0}
        onChange={(_, v) => { const n = parseInt(v, 10); setCurH(n); emit(n, curM, curA); }}
        width={60}
        colors={colors}
      />
      <Text style={{ fontSize: 28, fontWeight: "700", color: colors.text, marginBottom: 4 }}>:</Text>
      <WheelPicker
        items={MINUTES}
        initialIndex={mIdx}
        onChange={(i) => { setCurM(i); emit(curH, i, curA); }}
        width={68}
        colors={colors}
      />
      <WheelPicker
        items={AMPM}
        initialIndex={aIdx}
        onChange={(_, v) => { const a = v as "AM" | "PM"; setCurA(a); emit(curH, curM, a); }}
        width={58}
        colors={colors}
      />
    </View>
  );
}

export const EXERCISE_STEPS = Array.from({ length: 25 }, (_, i) => String(i * 5));

export function findExerciseIdx(minutes: number): number {
  const rounded = Math.round(minutes / 5) * 5;
  const idx = EXERCISE_STEPS.indexOf(String(rounded));
  return idx >= 0 ? idx : 0;
}

export function SimpleTimeInput({
  value,
  onChange,
  colors,
}: {
  value: string;
  onChange: (v: string) => void;
  colors: any;
}) {
  const parsed = parse24h(value || "08:00");
  const [text, setText] = React.useState(
    `${parsed.h12}:${String(parsed.min).padStart(2, "0")}`
  );
  const [period, setPeriod] = React.useState<"AM" | "PM">(parsed.ampm);

  const tryEmit = (t: string, p: "AM" | "PM") => {
    const m = t.match(/^(\d{1,2}):(\d{2})$/);
    if (m) {
      const h = parseInt(m[1], 10);
      const mn = parseInt(m[2], 10);
      if (h >= 1 && h <= 12 && mn >= 0 && mn <= 59) {
        onChange(to24h(h, mn, p));
      }
    }
  };

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <TextInput
        value={text}
        onChangeText={(t) => { setText(t); tryEmit(t, period); }}
        placeholder="10:30"
        keyboardType="numbers-and-punctuation"
        maxLength={5}
        style={{
          flex: 1,
          height: 52,
          borderRadius: 10,
          paddingHorizontal: 16,
          fontSize: 24,
          fontWeight: "600" as const,
          backgroundColor: colors.inputBg,
          color: colors.text,
        }}
      />
      <View
        style={{
          flexDirection: "row",
          borderRadius: 10,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <TouchableOpacity
          style={{
            paddingHorizontal: 18,
            paddingVertical: 14,
            backgroundColor: period === "AM" ? colors.teal : colors.sectionBg,
          }}
          onPress={() => { setPeriod("AM"); tryEmit(text, "AM"); }}
        >
          <Text style={{ color: period === "AM" ? "#fff" : colors.textSecondary, fontWeight: "600" as const, fontSize: 15 }}>
            AM
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{
            paddingHorizontal: 18,
            paddingVertical: 14,
            backgroundColor: period === "PM" ? colors.teal : colors.sectionBg,
          }}
          onPress={() => { setPeriod("PM"); tryEmit(text, "PM"); }}
        >
          <Text style={{ color: period === "PM" ? "#fff" : colors.textSecondary, fontWeight: "600" as const, fontSize: 15 }}>
            PM
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
