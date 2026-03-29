import React, { createContext, useContext, useCallback, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface MealEntry {
  id: string;
  date: string;
  time: string;
  foodDetails: string;
  imagePath?: string;
}

export interface WaterEntry {
  id: string;
  date: string;
  amountMl: number;
}

export interface SleepLog {
  id: string;
  date: string;
  bedtime: string;
  wakeTime: string;
  notes: string;
}

export interface ExerciseLog {
  id: string;
  date: string;
  running: number;
  walking: number;
  strengthTraining: number;
  cardio: number;
}

export interface TriggerEntry {
  id: string;
  date: string;
  category: string;
  description: string;
  severity: number;
  symptoms: string[];
}

export interface SymptomLog {
  id: string;
  date: string;
  pain: number;
  urgency: number;
  bloating: number;
  fatigue: number;
  notes: string;
  stoolType: number;
}

interface AppContextType {
  meals: MealEntry[];
  waterEntries: WaterEntry[];
  sleepLogs: SleepLog[];
  exerciseLogs: ExerciseLog[];
  triggers: TriggerEntry[];
  symptomLogs: SymptomLog[];
  addMeal: (meal: Omit<MealEntry, "id">) => Promise<void>;
  deleteMeal: (id: string) => Promise<void>;
  addWaterEntry: (entry: Omit<WaterEntry, "id">) => Promise<void>;
  addSleepLog: (log: Omit<SleepLog, "id">) => Promise<void>;
  updateSleepLog: (id: string, log: Partial<SleepLog>) => Promise<void>;
  saveExerciseLog: (log: Omit<ExerciseLog, "id">) => Promise<void>;
  addTrigger: (trigger: Omit<TriggerEntry, "id">) => Promise<void>;
  deleteTrigger: (id: string) => Promise<void>;
  addSymptomLog: (log: Omit<SymptomLog, "id">) => Promise<void>;
  updateSymptomLog: (id: string, log: Partial<SymptomLog>) => Promise<void>;
  getTodayWaterTotal: (date: string) => number;
  getTodaySleep: (date: string) => SleepLog | undefined;
  getTodayExercise: (date: string) => ExerciseLog | undefined;
  isLoading: boolean;
}

const STORAGE_KEYS = {
  MEALS: "mgi_meals",
  WATER: "mgi_water",
  SLEEP: "mgi_sleep",
  EXERCISE: "mgi_exercise",
  TRIGGERS: "mgi_triggers",
  SYMPTOMS: "mgi_symptoms",
};

const AppContext = createContext<AppContextType | undefined>(undefined);

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

async function loadData<T>(key: string): Promise<T[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    return JSON.parse(raw) as T[];
  } catch {
    return [];
  }
}

async function saveData<T>(key: string, data: T[]): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(data));
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [meals, setMeals] = useState<MealEntry[]>([]);
  const [waterEntries, setWaterEntries] = useState<WaterEntry[]>([]);
  const [sleepLogs, setSleepLogs] = useState<SleepLog[]>([]);
  const [exerciseLogs, setExerciseLogs] = useState<ExerciseLog[]>([]);
  const [triggers, setTriggers] = useState<TriggerEntry[]>([]);
  const [symptomLogs, setSymptomLogs] = useState<SymptomLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const [m, w, s, ex, t, sym] = await Promise.all([
        loadData<MealEntry>(STORAGE_KEYS.MEALS),
        loadData<WaterEntry>(STORAGE_KEYS.WATER),
        loadData<SleepLog>(STORAGE_KEYS.SLEEP),
        loadData<ExerciseLog>(STORAGE_KEYS.EXERCISE),
        loadData<TriggerEntry>(STORAGE_KEYS.TRIGGERS),
        loadData<SymptomLog>(STORAGE_KEYS.SYMPTOMS),
      ]);
      setMeals(m);
      setWaterEntries(w);
      setSleepLogs(s);
      setExerciseLogs(ex);
      setTriggers(t);
      setSymptomLogs(sym);
      setIsLoading(false);
    };
    init();
  }, []);

  const addMeal = useCallback(async (meal: Omit<MealEntry, "id">) => {
    const newMeal: MealEntry = { ...meal, id: generateId() };
    setMeals((prev) => {
      const updated = [...prev, newMeal];
      saveData(STORAGE_KEYS.MEALS, updated);
      return updated;
    });
  }, []);

  const deleteMeal = useCallback(async (id: string) => {
    setMeals((prev) => {
      const updated = prev.filter((m) => m.id !== id);
      saveData(STORAGE_KEYS.MEALS, updated);
      return updated;
    });
  }, []);

  const addWaterEntry = useCallback(async (entry: Omit<WaterEntry, "id">) => {
    const newEntry: WaterEntry = { ...entry, id: generateId() };
    setWaterEntries((prev) => {
      const updated = [...prev, newEntry];
      saveData(STORAGE_KEYS.WATER, updated);
      return updated;
    });
  }, []);

  const addSleepLog = useCallback(async (log: Omit<SleepLog, "id">) => {
    const newLog: SleepLog = { ...log, id: generateId() };
    setSleepLogs((prev) => {
      const existing = prev.findIndex((s) => s.date === log.date);
      let updated: SleepLog[];
      if (existing >= 0) {
        updated = [...prev];
        updated[existing] = newLog;
      } else {
        updated = [...prev, newLog];
      }
      saveData(STORAGE_KEYS.SLEEP, updated);
      return updated;
    });
  }, []);

  const updateSleepLog = useCallback(async (id: string, log: Partial<SleepLog>) => {
    setSleepLogs((prev) => {
      const updated = prev.map((s) => (s.id === id ? { ...s, ...log } : s));
      saveData(STORAGE_KEYS.SLEEP, updated);
      return updated;
    });
  }, []);

  const saveExerciseLog = useCallback(async (log: Omit<ExerciseLog, "id">) => {
    const newLog: ExerciseLog = { ...log, id: generateId() };
    setExerciseLogs((prev) => {
      const existing = prev.findIndex((e) => e.date === log.date);
      let updated: ExerciseLog[];
      if (existing >= 0) {
        updated = [...prev];
        updated[existing] = newLog;
      } else {
        updated = [...prev, newLog];
      }
      saveData(STORAGE_KEYS.EXERCISE, updated);
      return updated;
    });
  }, []);

  const addTrigger = useCallback(async (trigger: Omit<TriggerEntry, "id">) => {
    const newTrigger: TriggerEntry = { ...trigger, id: generateId() };
    setTriggers((prev) => {
      const updated = [...prev, newTrigger];
      saveData(STORAGE_KEYS.TRIGGERS, updated);
      return updated;
    });
  }, []);

  const deleteTrigger = useCallback(async (id: string) => {
    setTriggers((prev) => {
      const updated = prev.filter((t) => t.id !== id);
      saveData(STORAGE_KEYS.TRIGGERS, updated);
      return updated;
    });
  }, []);

  const addSymptomLog = useCallback(async (log: Omit<SymptomLog, "id">) => {
    const newLog: SymptomLog = { ...log, id: generateId() };
    setSymptomLogs((prev) => {
      const existing = prev.findIndex((s) => s.date === log.date);
      let updated: SymptomLog[];
      if (existing >= 0) {
        updated = [...prev];
        updated[existing] = newLog;
      } else {
        updated = [...prev, newLog];
      }
      saveData(STORAGE_KEYS.SYMPTOMS, updated);
      return updated;
    });
  }, []);

  const updateSymptomLog = useCallback(async (id: string, log: Partial<SymptomLog>) => {
    setSymptomLogs((prev) => {
      const updated = prev.map((s) => (s.id === id ? { ...s, ...log } : s));
      saveData(STORAGE_KEYS.SYMPTOMS, updated);
      return updated;
    });
  }, []);

  const getTodayWaterTotal = useCallback(
    (date: string) => {
      return waterEntries
        .filter((w) => w.date === date)
        .reduce((sum, w) => sum + w.amountMl, 0);
    },
    [waterEntries]
  );

  const getTodaySleep = useCallback(
    (date: string) => {
      return sleepLogs.find((s) => s.date === date);
    },
    [sleepLogs]
  );

  const getTodayExercise = useCallback(
    (date: string) => {
      return exerciseLogs.find((e) => e.date === date);
    },
    [exerciseLogs]
  );

  return (
    <AppContext.Provider
      value={{
        meals,
        waterEntries,
        sleepLogs,
        exerciseLogs,
        triggers,
        symptomLogs,
        addMeal,
        deleteMeal,
        addWaterEntry,
        addSleepLog,
        updateSleepLog,
        saveExerciseLog,
        addTrigger,
        deleteTrigger,
        addSymptomLog,
        updateSymptomLog,
        getTodayWaterTotal,
        getTodaySleep,
        getTodayExercise,
        isLoading,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
