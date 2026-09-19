import React, { createContext, useContext, useCallback, useState, useEffect, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface MealEntry {
  id: string;
  date: string;
  time: string;
  foodDetails: string;
  imagePath?: string;
  images?: string[];
  calories?: number;
  protein?: number;
  carbs?: number;
  fats?: number;
  fiber?: number;
}

export interface WaterEntry {
  id: string;
  date: string;
  amountMl: number;
  time?: string;
  notes?: string;
}

export interface SleepLog {
  id: string;
  date: string;
  bedtime: string;
  wakeTime: string;
  notes: string;
}

export interface CustomActivity {
  name: string;
  minutes: number;
}

export interface ExerciseLog {
  id: string;
  date: string;
  running: number;
  walking: number;
  strengthTraining: number;
  cardio: number;
  customActivities?: CustomActivity[];
}

export interface BowelLog {
  id: string;
  date: string;
  color: "red" | "yellow" | "green";
  photos: string[];
  count: number;
}

export interface WeightEntry {
  id: string;
  date: string;
  weightKg: number;
  notes?: string;
}

export type FoodCategory = string;

export interface FoodTrigger {
  id: string;
  date: string;
  time?: string;
  food: string;
  notes: string;
  category: FoodCategory;
}

export interface Medication {
  id: string;
  name: string;
  notes: string;
  reminderTime: string;
  reminderDays: string[];
  createdAt: string;
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

export interface MenuLink {
  url: string;
  label?: string;
}

export interface MenuItem {
  id: string;
  weekStart: string;
  dayOfWeek: number;
  time: string;
  recipe: string;
  notes: string;
  links: MenuLink[];
}

export interface UserProfile {
  name: string;
  email: string;
  age: string;
  height: string;
  weight: string;
}

interface AppContextType {
  meals: MealEntry[];
  waterEntries: WaterEntry[];
  sleepLogs: SleepLog[];
  exerciseLogs: ExerciseLog[];
  bowelLogs: BowelLog[];
  weightLogs: WeightEntry[];
  foodTriggers: FoodTrigger[];
  medications: Medication[];
  triggers: TriggerEntry[];
  symptomLogs: SymptomLog[];
  profile: UserProfile;
  waterGoalMl: number;
  sleepGoalHours: number;
  exerciseGoalMinutes: number;
  weightGoalKg: number;
  calorieGoal: number;
  proteinGoal: number;
  carbsGoal: number;
  fatsGoal: number;
  fiberGoal: number;
  addMeal: (meal: Omit<MealEntry, "id">) => Promise<void>;
  updateMeal: (id: string, meal: Partial<MealEntry>) => Promise<void>;
  deleteMeal: (id: string) => Promise<void>;
  addWaterEntry: (entry: Omit<WaterEntry, "id">) => Promise<void>;
  deleteWaterEntry: (id: string) => Promise<void>;
  updateWaterEntry: (id: string, amountMl: number) => Promise<void>;
  addSleepLog: (log: Omit<SleepLog, "id">) => Promise<void>;
  updateSleepLog: (id: string, log: Partial<SleepLog>) => Promise<void>;
  saveExerciseLog: (log: Omit<ExerciseLog, "id">) => Promise<void>;
  saveBowelLog: (log: Omit<BowelLog, "id">) => Promise<void>;
  deleteBowelPhoto: (date: string, photoUri: string) => Promise<void>;
  saveWeightEntry: (entry: Omit<WeightEntry, "id">) => Promise<void>;
  deleteWeightEntry: (id: string) => Promise<void>;
  addFoodTrigger: (t: Omit<FoodTrigger, "id">) => Promise<void>;
  updateFoodTrigger: (id: string, t: Partial<FoodTrigger>) => Promise<void>;
  deleteFoodTrigger: (id: string) => Promise<void>;
  addMedication: (m: Omit<Medication, "id">) => Promise<void>;
  updateMedication: (id: string, m: Partial<Medication>) => Promise<void>;
  deleteMedication: (id: string) => Promise<void>;
  addTrigger: (trigger: Omit<TriggerEntry, "id">) => Promise<void>;
  deleteTrigger: (id: string) => Promise<void>;
  menuItems: MenuItem[];
  addMenuItem: (item: Omit<MenuItem, "id">) => Promise<void>;
  updateMenuItem: (id: string, item: Partial<MenuItem>) => Promise<void>;
  deleteMenuItem: (id: string) => Promise<void>;
  getWeekMenuItems: (weekStart: string) => MenuItem[];
  addSymptomLog: (log: Omit<SymptomLog, "id">) => Promise<void>;
  updateSymptomLog: (id: string, log: Partial<SymptomLog>) => Promise<void>;
  saveProfile: (profile: UserProfile) => Promise<void>;
  setWaterGoalMl: (ml: number) => Promise<void>;
  setSleepGoalHours: (h: number) => Promise<void>;
  setExerciseGoalMinutes: (m: number) => Promise<void>;
  setWeightGoalKg: (kg: number) => Promise<void>;
  setCalorieGoal: (v: number) => Promise<void>;
  setProteinGoal: (v: number) => Promise<void>;
  setCarbsGoal: (v: number) => Promise<void>;
  setFatsGoal: (v: number) => Promise<void>;
  setFiberGoal: (v: number) => Promise<void>;
  getTodayWaterTotal: (date: string) => number;
  getTodaySleep: (date: string) => SleepLog | undefined;
  getTodayExercise: (date: string) => ExerciseLog | undefined;
  getBowelLog: (date: string) => BowelLog | undefined;
  getWeightEntry: (date: string) => WeightEntry | undefined;
  isLoading: boolean;
}

const STORAGE_KEYS = {
  MEALS: "mgi_meals",
  WATER: "mgi_water",
  SLEEP: "mgi_sleep",
  EXERCISE: "mgi_exercise",
  BOWEL: "mgi_bowel",
  WEIGHT: "mgi_weight",
  FOOD_TRIGGERS: "mgi_food_triggers",
  MEDICATIONS: "mgi_medications",
  TRIGGERS: "mgi_triggers",
  SYMPTOMS: "mgi_symptoms",
  WATER_GOAL: "mgi_water_goal",
  SLEEP_GOAL: "mgi_sleep_goal",
  EXERCISE_GOAL: "mgi_exercise_goal",
  WEIGHT_GOAL: "mgi_weight_goal",
  MENU: "mgi_menu_items",
  CALORIE_GOAL: "mgi_calorie_goal",
  PROTEIN_GOAL: "mgi_protein_goal",
  CARBS_GOAL: "mgi_carbs_goal",
  FATS_GOAL: "mgi_fats_goal",
  FIBER_GOAL: "mgi_fiber_goal",
  PROFILE: "mgi_user_profile",
};

const DEFAULT_PROFILE: UserProfile = {
  name: "",
  email: "",
  age: "",
  height: "",
  weight: "",
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

async function loadObject<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...JSON.parse(raw) } as T;
  } catch {
    return fallback;
  }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [meals, setMeals] = useState<MealEntry[]>([]);
  const [waterEntries, setWaterEntries] = useState<WaterEntry[]>([]);
  const [sleepLogs, setSleepLogs] = useState<SleepLog[]>([]);
  const [exerciseLogs, setExerciseLogs] = useState<ExerciseLog[]>([]);
  const [bowelLogs, setBowelLogs] = useState<BowelLog[]>([]);
  const [weightLogs, setWeightLogs] = useState<WeightEntry[]>([]);
  const [foodTriggers, setFoodTriggers] = useState<FoodTrigger[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [triggers, setTriggers] = useState<TriggerEntry[]>([]);
  const [symptomLogs, setSymptomLogs] = useState<SymptomLog[]>([]);
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [waterGoalMl, setWaterGoalMlState] = useState<number>(3785);
  const [sleepGoalHours, setSleepGoalHoursState] = useState<number>(8);
  const [exerciseGoalMinutes, setExerciseGoalMinutesState] = useState<number>(30);
  const [weightGoalKg, setWeightGoalKgState] = useState<number>(70);
  const [calorieGoal, setCalorieGoalState] = useState<number>(2000);
  const [proteinGoal, setProteinGoalState] = useState<number>(50);
  const [carbsGoal, setCarbsGoalState] = useState<number>(250);
  const [fatsGoal, setFatsGoalState] = useState<number>(65);
  const [fiberGoal, setFiberGoalState] = useState<number>(25);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const menuItemsRef = useRef<MenuItem[]>([]);
  const menuWriteQueueRef = useRef<Promise<void>>(Promise.resolve());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const [m, w, s, ex, b, wt, ft, med, t, sym, mn, savedProfile] = await Promise.all([
        loadData<MealEntry>(STORAGE_KEYS.MEALS),
        loadData<WaterEntry>(STORAGE_KEYS.WATER),
        loadData<SleepLog>(STORAGE_KEYS.SLEEP),
        loadData<ExerciseLog>(STORAGE_KEYS.EXERCISE),
        loadData<BowelLog>(STORAGE_KEYS.BOWEL),
        loadData<WeightEntry>(STORAGE_KEYS.WEIGHT),
        loadData<FoodTrigger>(STORAGE_KEYS.FOOD_TRIGGERS),
        loadData<Medication>(STORAGE_KEYS.MEDICATIONS),
        loadData<TriggerEntry>(STORAGE_KEYS.TRIGGERS),
        loadData<SymptomLog>(STORAGE_KEYS.SYMPTOMS),
        loadData<MenuItem>(STORAGE_KEYS.MENU),
        loadObject<UserProfile>(STORAGE_KEYS.PROFILE, DEFAULT_PROFILE),
      ]);
      const [wg, sg, eg, wtg, cg, pg, crg, fg, fibg] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.WATER_GOAL),
        AsyncStorage.getItem(STORAGE_KEYS.SLEEP_GOAL),
        AsyncStorage.getItem(STORAGE_KEYS.EXERCISE_GOAL),
        AsyncStorage.getItem(STORAGE_KEYS.WEIGHT_GOAL),
        AsyncStorage.getItem(STORAGE_KEYS.CALORIE_GOAL),
        AsyncStorage.getItem(STORAGE_KEYS.PROTEIN_GOAL),
        AsyncStorage.getItem(STORAGE_KEYS.CARBS_GOAL),
        AsyncStorage.getItem(STORAGE_KEYS.FATS_GOAL),
        AsyncStorage.getItem(STORAGE_KEYS.FIBER_GOAL),
      ]);
      setMeals(m);
      setWaterEntries(w);
      setSleepLogs(s);
      setExerciseLogs(ex);
      setBowelLogs(b);
      setWeightLogs(wt);
      setFoodTriggers(ft);
      setMedications(med);
      setTriggers(t);
      setSymptomLogs(sym);
      setMenuItems(mn);
      menuItemsRef.current = mn;
      setProfile(savedProfile);
      if (wg) setWaterGoalMlState(parseInt(wg, 10));
      if (sg) setSleepGoalHoursState(parseFloat(sg));
      if (eg) setExerciseGoalMinutesState(parseInt(eg, 10));
      if (wtg) setWeightGoalKgState(parseFloat(wtg));
      if (cg) setCalorieGoalState(parseInt(cg, 10));
      if (pg) setProteinGoalState(parseInt(pg, 10));
      if (crg) setCarbsGoalState(parseInt(crg, 10));
      if (fg) setFatsGoalState(parseInt(fg, 10));
      if (fibg) setFiberGoalState(parseInt(fibg, 10));
      setIsLoading(false);
    };
    init();
  }, []);

  const addMeal = useCallback(async (meal: Omit<MealEntry, "id">) => {
    const n: MealEntry = { ...meal, id: generateId() };
    setMeals((p) => { const u = [...p, n]; saveData(STORAGE_KEYS.MEALS, u); return u; });
  }, []);

  const updateMeal = useCallback(async (id: string, meal: Partial<MealEntry>) => {
    setMeals((p) => { const u = p.map((m) => m.id === id ? { ...m, ...meal } : m); saveData(STORAGE_KEYS.MEALS, u); return u; });
  }, []);

  const deleteMeal = useCallback(async (id: string) => {
    setMeals((p) => { const u = p.filter((m) => m.id !== id); saveData(STORAGE_KEYS.MEALS, u); return u; });
  }, []);

  const addWaterEntry = useCallback(async (entry: Omit<WaterEntry, "id">) => {
    const n: WaterEntry = { ...entry, id: generateId() };
    setWaterEntries((p) => { const u = [...p, n]; saveData(STORAGE_KEYS.WATER, u); return u; });
  }, []);

  const deleteWaterEntry = useCallback(async (id: string) => {
    setWaterEntries((p) => { const u = p.filter((w) => w.id !== id); saveData(STORAGE_KEYS.WATER, u); return u; });
  }, []);

  const updateWaterEntry = useCallback(async (id: string, amountMl: number) => {
    setWaterEntries((p) => { const u = p.map((w) => w.id === id ? { ...w, amountMl } : w); saveData(STORAGE_KEYS.WATER, u); return u; });
  }, []);

  const addSleepLog = useCallback(async (log: Omit<SleepLog, "id">) => {
    const n: SleepLog = { ...log, id: generateId() };
    setSleepLogs((p) => {
      const idx = p.findIndex((s) => s.date === log.date);
      const u = idx >= 0 ? p.map((s, i) => i === idx ? n : s) : [...p, n];
      saveData(STORAGE_KEYS.SLEEP, u); return u;
    });
  }, []);

  const updateSleepLog = useCallback(async (id: string, log: Partial<SleepLog>) => {
    setSleepLogs((p) => { const u = p.map((s) => s.id === id ? { ...s, ...log } : s); saveData(STORAGE_KEYS.SLEEP, u); return u; });
  }, []);

  const saveExerciseLog = useCallback(async (log: Omit<ExerciseLog, "id">) => {
    const n: ExerciseLog = { ...log, id: generateId() };
    setExerciseLogs((p) => {
      const idx = p.findIndex((e) => e.date === log.date);
      const u = idx >= 0 ? p.map((e, i) => i === idx ? n : e) : [...p, n];
      saveData(STORAGE_KEYS.EXERCISE, u); return u;
    });
  }, []);

  const saveBowelLog = useCallback(async (log: Omit<BowelLog, "id">) => {
    const n: BowelLog = { ...log, id: generateId() };
    setBowelLogs((p) => {
      const idx = p.findIndex((b) => b.date === log.date);
      const u = idx >= 0 ? p.map((b, i) => i === idx ? n : b) : [...p, n];
      saveData(STORAGE_KEYS.BOWEL, u); return u;
    });
  }, []);

  const deleteBowelPhoto = useCallback(async (date: string, photoUri: string) => {
    setBowelLogs((p) => {
      const u = p.map((b) => b.date === date ? { ...b, photos: b.photos.filter((ph) => ph !== photoUri) } : b);
      saveData(STORAGE_KEYS.BOWEL, u); return u;
    });
  }, []);

  const saveWeightEntry = useCallback(async (entry: Omit<WeightEntry, "id">) => {
    const n: WeightEntry = { ...entry, id: generateId() };
    setWeightLogs((p) => {
      const idx = p.findIndex((w) => w.date === entry.date);
      const u = idx >= 0 ? p.map((w, i) => i === idx ? n : w) : [...p, n];
      saveData(STORAGE_KEYS.WEIGHT, u); return u;
    });
  }, []);

  const deleteWeightEntry = useCallback(async (id: string) => {
    setWeightLogs((p) => { const u = p.filter((w) => w.id !== id); saveData(STORAGE_KEYS.WEIGHT, u); return u; });
  }, []);

  const addFoodTrigger = useCallback(async (t: Omit<FoodTrigger, "id">) => {
    const n: FoodTrigger = { ...t, id: generateId() };
    setFoodTriggers((p) => { const u = [...p, n]; saveData(STORAGE_KEYS.FOOD_TRIGGERS, u); return u; });
  }, []);

  const updateFoodTrigger = useCallback(async (id: string, t: Partial<FoodTrigger>) => {
    setFoodTriggers((p) => { const u = p.map((f) => f.id === id ? { ...f, ...t } : f); saveData(STORAGE_KEYS.FOOD_TRIGGERS, u); return u; });
  }, []);

  const deleteFoodTrigger = useCallback(async (id: string) => {
    setFoodTriggers((p) => { const u = p.filter((f) => f.id !== id); saveData(STORAGE_KEYS.FOOD_TRIGGERS, u); return u; });
  }, []);

  const addMedication = useCallback(async (m: Omit<Medication, "id">) => {
    const n: Medication = { ...m, id: generateId() };
    setMedications((p) => { const u = [...p, n]; saveData(STORAGE_KEYS.MEDICATIONS, u); return u; });
  }, []);

  const updateMedication = useCallback(async (id: string, m: Partial<Medication>) => {
    setMedications((p) => { const u = p.map((med) => med.id === id ? { ...med, ...m } : med); saveData(STORAGE_KEYS.MEDICATIONS, u); return u; });
  }, []);

  const deleteMedication = useCallback(async (id: string) => {
    setMedications((p) => { const u = p.filter((m) => m.id !== id); saveData(STORAGE_KEYS.MEDICATIONS, u); return u; });
  }, []);

  const addTrigger = useCallback(async (trigger: Omit<TriggerEntry, "id">) => {
    const n: TriggerEntry = { ...trigger, id: generateId() };
    setTriggers((p) => { const u = [...p, n]; saveData(STORAGE_KEYS.TRIGGERS, u); return u; });
  }, []);

  const deleteTrigger = useCallback(async (id: string) => {
    setTriggers((p) => { const u = p.filter((t) => t.id !== id); saveData(STORAGE_KEYS.TRIGGERS, u); return u; });
  }, []);

  const persistMenuMutation = useCallback(
    async (mutate: (items: MenuItem[]) => MenuItem[]) => {
      const write = menuWriteQueueRef.current.then(async () => {
        const next = mutate(menuItemsRef.current);
        await saveData(STORAGE_KEYS.MENU, next);
        menuItemsRef.current = next;
        setMenuItems(next);
      });
      menuWriteQueueRef.current = write.catch(() => undefined);
      await write;
    },
    [],
  );

  const addMenuItem = useCallback(async (item: Omit<MenuItem, "id">) => {
    const n: MenuItem = { ...item, id: generateId() };
    await persistMenuMutation((items) => [...items, n]);
  }, [persistMenuMutation]);

  const updateMenuItem = useCallback(async (id: string, item: Partial<MenuItem>) => {
    await persistMenuMutation((items) => items.map((m) => m.id === id ? { ...m, ...item } : m));
  }, [persistMenuMutation]);

  const deleteMenuItem = useCallback(async (id: string) => {
    await persistMenuMutation((items) => items.filter((m) => m.id !== id));
  }, [persistMenuMutation]);

  const getWeekMenuItems = useCallback(
    (weekStart: string) => menuItems.filter((m) => m.weekStart === weekStart).sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.time.localeCompare(b.time)),
    [menuItems]
  );

  const addSymptomLog = useCallback(async (log: Omit<SymptomLog, "id">) => {
    const n: SymptomLog = { ...log, id: generateId() };
    setSymptomLogs((p) => {
      const idx = p.findIndex((s) => s.date === log.date);
      const u = idx >= 0 ? p.map((s, i) => i === idx ? n : s) : [...p, n];
      saveData(STORAGE_KEYS.SYMPTOMS, u); return u;
    });
  }, []);

  const updateSymptomLog = useCallback(async (id: string, log: Partial<SymptomLog>) => {
    setSymptomLogs((p) => { const u = p.map((s) => s.id === id ? { ...s, ...log } : s); saveData(STORAGE_KEYS.SYMPTOMS, u); return u; });
  }, []);

  const saveProfile = useCallback(async (nextProfile: UserProfile) => {
    setProfile(nextProfile);
    await AsyncStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(nextProfile));
  }, []);

  const setWaterGoalMl = useCallback(async (ml: number) => {
    setWaterGoalMlState(ml);
    await AsyncStorage.setItem(STORAGE_KEYS.WATER_GOAL, String(ml));
  }, []);

  const setSleepGoalHours = useCallback(async (h: number) => {
    setSleepGoalHoursState(h);
    await AsyncStorage.setItem(STORAGE_KEYS.SLEEP_GOAL, String(h));
  }, []);

  const setExerciseGoalMinutes = useCallback(async (m: number) => {
    setExerciseGoalMinutesState(m);
    await AsyncStorage.setItem(STORAGE_KEYS.EXERCISE_GOAL, String(m));
  }, []);

  const setWeightGoalKg = useCallback(async (kg: number) => {
    setWeightGoalKgState(kg);
    await AsyncStorage.setItem(STORAGE_KEYS.WEIGHT_GOAL, String(kg));
  }, []);

  const setCalorieGoal = useCallback(async (v: number) => {
    setCalorieGoalState(v);
    await AsyncStorage.setItem(STORAGE_KEYS.CALORIE_GOAL, String(v));
  }, []);

  const setProteinGoal = useCallback(async (v: number) => {
    setProteinGoalState(v);
    await AsyncStorage.setItem(STORAGE_KEYS.PROTEIN_GOAL, String(v));
  }, []);

  const setCarbsGoal = useCallback(async (v: number) => {
    setCarbsGoalState(v);
    await AsyncStorage.setItem(STORAGE_KEYS.CARBS_GOAL, String(v));
  }, []);

  const setFatsGoal = useCallback(async (v: number) => {
    setFatsGoalState(v);
    await AsyncStorage.setItem(STORAGE_KEYS.FATS_GOAL, String(v));
  }, []);

  const setFiberGoal = useCallback(async (v: number) => {
    setFiberGoalState(v);
    await AsyncStorage.setItem(STORAGE_KEYS.FIBER_GOAL, String(v));
  }, []);

  const getTodayWaterTotal = useCallback(
    (date: string) => waterEntries.filter((w) => w.date === date).reduce((sum, w) => sum + w.amountMl, 0),
    [waterEntries]
  );

  const getTodaySleep = useCallback(
    (date: string) => sleepLogs.find((s) => s.date === date),
    [sleepLogs]
  );

  const getTodayExercise = useCallback(
    (date: string) => exerciseLogs.find((e) => e.date === date),
    [exerciseLogs]
  );

  const getBowelLog = useCallback(
    (date: string) => bowelLogs.find((b) => b.date === date),
    [bowelLogs]
  );

  const getWeightEntry = useCallback(
    (date: string) => weightLogs.find((w) => w.date === date),
    [weightLogs]
  );

  return (
    <AppContext.Provider
      value={{
        meals, waterEntries, sleepLogs, exerciseLogs, bowelLogs, weightLogs,
        foodTriggers, medications, triggers, symptomLogs,
        profile,
        waterGoalMl, sleepGoalHours, exerciseGoalMinutes, weightGoalKg,
        calorieGoal, proteinGoal, carbsGoal, fatsGoal, fiberGoal,
        addMeal, updateMeal, deleteMeal,
        addWaterEntry, deleteWaterEntry, updateWaterEntry,
        addSleepLog, updateSleepLog,
        saveExerciseLog, saveBowelLog, deleteBowelPhoto,
        saveWeightEntry, deleteWeightEntry,
        addFoodTrigger, updateFoodTrigger, deleteFoodTrigger,
        addMedication, updateMedication, deleteMedication,
        addTrigger, deleteTrigger,
        menuItems, addMenuItem, updateMenuItem, deleteMenuItem, getWeekMenuItems,
        addSymptomLog, updateSymptomLog,
        saveProfile,
        setWaterGoalMl, setSleepGoalHours, setExerciseGoalMinutes, setWeightGoalKg,
        setCalorieGoal, setProteinGoal, setCarbsGoal, setFatsGoal, setFiberGoal,
        getTodayWaterTotal, getTodaySleep, getTodayExercise, getBowelLog, getWeightEntry,
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
