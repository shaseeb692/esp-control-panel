"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

import {
  Tv,
  Lightbulb,
  Wind,
  Plus,
  Trash2,
  Settings,
  Radio,
  Droplets,
  Zap,
  Power,
  Activity,
  Search,
  Microwave,
  Snowflake,
  Fan,
  CircuitBoard,
  Plug,
  Waves,
  Refrigerator,
  LampCeiling,
  Router,
  Coffee,
  WashingMachine,
  Heater,
  Flame,
  Speaker,
  Monitor,
  BatteryCharging,
  Gauge,
  ShieldCheck,
} from "lucide-react";

/* =====================================================
   THEME
   CHANGE ONLY THIS HEX COLOR
===================================================== */

const THEME_COLOR = "#42B8C5";

/* =====================================================
   TYPES
===================================================== */

type ToggleConfig = {
  id: number;
  name: string;
  icon: string;
  onCommand: string;
  offCommand: string;
  debounce: number;
};

type ButtonConfig = {
  id: number;
  name: string;
  icon: string;
  command: string;
  debounce: number;
};

type SliderConfig = {
  id: number;
  name: string;
  icon: string;
  command: string;
  min: number;
  max: number;
  unit: string;
};

type RuntimeData = {
  day: string;
  minutes: number;
};

/* Supabase row type */
type RuntimeRow = {
  runtime_date: string;
  runtime_minutes: number;
};

/* =====================================================
   DEFAULT TOGGLE
===================================================== */

const defaultToggle: ToggleConfig = {
  id: 1,
  name: "Motor 1",
  icon: "motor",
  onCommand: "M1_ON",
  offCommand: "M1_OFF",
  debounce: 300,
};

/* =====================================================
   ICON OPTIONS
===================================================== */

const iconOptions = [
  {
    name: "Motor",
    value: "motor",
    icon: Waves,
  },
  {
    name: "TV",
    value: "tv",
    icon: Tv,
  },
  {
    name: "Light",
    value: "light",
    icon: Lightbulb,
  },
  {
    name: "AC",
    value: "ac",
    icon: Snowflake,
  },
  {
    name: "Fan",
    value: "fan",
    icon: Fan,
  },
  {
    name: "Microwave",
    value: "microwave",
    icon: Microwave,
  },
  {
    name: "Inverter",
    value: "inverter",
    icon: CircuitBoard,
  },
  {
    name: "Breaker",
    value: "breaker",
    icon: ShieldCheck,
  },
  {
    name: "Power",
    value: "power",
    icon: Power,
  },
  {
    name: "Plug",
    value: "plug",
    icon: Plug,
  },
  {
    name: "Water",
    value: "water",
    icon: Droplets,
  },
  {
    name: "Fridge",
    value: "fridge",
    icon: Refrigerator,
  },
  {
    name: "Washing Machine",
    value: "washing",
    icon: WashingMachine,
  },
  {
    name: "Heater",
    value: "heater",
    icon: Heater,
  },
  {
    name: "Fire",
    value: "fire",
    icon: Flame,
  },
  {
    name: "Lamp",
    value: "lamp",
    icon: LampCeiling,
  },
  {
    name: "Router",
    value: "router",
    icon: Router,
  },
  {
    name: "Coffee",
    value: "coffee",
    icon: Coffee,
  },
  {
    name: "Speaker",
    value: "speaker",
    icon: Speaker,
  },
  {
    name: "Monitor",
    value: "monitor",
    icon: Monitor,
  },
  {
    name: "Battery",
    value: "battery",
    icon: BatteryCharging,
  },
  {
    name: "Gauge",
    value: "gauge",
    icon: Gauge,
  },
  {
    name: "Wind",
    value: "wind",
    icon: Wind,
  },
  {
    name: "Zap",
    value: "zap",
    icon: Zap,
  },
  {
    name: "Activity",
    value: "activity",
    icon: Activity,
  },
];

/* =====================================================
   DEVICE ICON
===================================================== */

function DeviceIcon({
  icon,
  size = 32,
}: {
  icon: string;
  size?: number;
}) {
  const found = iconOptions.find(
    (item) => item.value === icon
  );

  const IconComponent =
    found?.icon ?? Activity;

  return (
    <IconComponent
      size={size}
      strokeWidth={1.6}
    />
  );
}

/* =====================================================
   SEARCHABLE ICON PICKER
===================================================== */

function IconPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [search, setSearch] =
    useState("");

  const filteredIcons =
    iconOptions.filter((item) =>
      item.name
        .toLowerCase()
        .includes(
          search.toLowerCase()
        )
    );

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">

      {/* SEARCH */}

      <div className="mb-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">

        <Search
          size={17}
          className="text-slate-400"
        />

        <input
          value={search}
          onChange={(e) =>
            setSearch(
              e.target.value
            )
          }
          placeholder="Search icon..."
          className="w-full bg-transparent py-3 text-sm outline-none"
        />

      </div>

      {/* ICON GRID */}

      <div className="grid max-h-64 grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-6">

        {filteredIcons.map(
          (item) => {

            const selected =
              value ===
              item.value;

            const IconComponent =
              item.icon;

            return (
              <button
                key={
                  item.value
                }
                type="button"
                onClick={() =>
                  onChange(
                    item.value
                  )
                }
                className="flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-xl border transition-all"
                style={{
                  borderColor:
                    selected
                      ? THEME_COLOR
                      : "#e2e8f0",

                  backgroundColor:
                    selected
                      ? `${THEME_COLOR}15`
                      : "white",

                  color:
                    selected
                      ? THEME_COLOR
                      : "#64748b",
                }}
              >

                <IconComponent
                  size={24}
                  strokeWidth={1.6}
                />

                <span className="text-[10px]">
                  {item.name}
                </span>

              </button>
            );
          }
        )}

      </div>

    </div>
  );
}

/* =====================================================
   MAIN PAGE
===================================================== */

export default function DevicePage() {

  const params =
    useParams();

  const deviceId =
    typeof params?.deviceId ===
    "string"
      ? params.deviceId
      : "ESP001";

  const [editMode, setEditMode] =
    useState(false);

  const [toggles, setToggles] =
    useState<ToggleConfig[]>([
      defaultToggle,
    ]);

  const [buttons, setButtons] =
    useState<ButtonConfig[]>([]);

  const [sliders, setSliders] =
    useState<SliderConfig[]>([]);

  const [motorStates, setMotorStates] =
    useState<
      Record<number, boolean>
    >({
      1: false,
    });

  const [sliderValues, setSliderValues] =
    useState<
      Record<number, number>
    >({});

  const [sending, setSending] =
    useState(false);

  const [saved, setSaved] =
    useState(false);

  /* =====================================================
     RUNTIME STATE
  ===================================================== */

  const [runtimeData, setRuntimeData] =
    useState<RuntimeData[]>([
      {
        day: "Mon",
        minutes: 0,
      },
      {
        day: "Tue",
        minutes: 0,
      },
      {
        day: "Wed",
        minutes: 0,
      },
      {
        day: "Thu",
        minutes: 0,
      },
      {
        day: "Fri",
        minutes: 0,
      },
      {
        day: "Sat",
        minutes: 0,
      },
      {
        day: "Sun",
        minutes: 0,
      },
    ]);

  /* =====================================================
     LOAD SAVED CONFIGURATION
  ===================================================== */

  useEffect(() => {

    const savedConfig =
      localStorage.getItem(
        `device-${deviceId}-configuration`
      );

    if (!savedConfig) {
      return;
    }

    try {

      const config =
        JSON.parse(
          savedConfig
        );

      if (
        Array.isArray(
          config.toggles
        )
      ) {
        setToggles(
          config.toggles
        );
      }

      if (
        Array.isArray(
          config.buttons
        )
      ) {
        setButtons(
          config.buttons
        );
      }

      if (
        Array.isArray(
          config.sliders
        )
      ) {
        setSliders(
          config.sliders
        );
      }

    } catch (error) {

      console.error(
        "Invalid configuration:",
        error
      );

    }

  }, [deviceId]);

  /* =====================================================
     LOAD WEEKLY RUNTIME FROM SUPABASE
  ===================================================== */

  useEffect(() => {

    async function loadRuntimeData() {

      /*
        Find Monday of current week
      */

      const today =
        new Date();

      const dayOfWeek =
        today.getDay();

      const monday =
        new Date(today);

      const daysFromMonday =
        dayOfWeek === 0
          ? 6
          : dayOfWeek - 1;

      monday.setDate(
        today.getDate() -
          daysFromMonday
      );

      monday.setHours(
        0,
        0,
        0,
        0
      );

      /*
        Find Sunday
      */

      const sunday =
        new Date(monday);

      sunday.setDate(
        monday.getDate() + 6
      );

      /*
        Format local date
        as YYYY-MM-DD
      */

      function formatDate(
        date: Date
      ): string {

        const year =
          date.getFullYear();

        const month =
          String(
            date.getMonth() + 1
          ).padStart(2, "0");

        const day =
          String(
            date.getDate()
          ).padStart(2, "0");

        return `${year}-${month}-${day}`;
      }

      /*
        Query Supabase
      */

      const {
        data,
        error,
      } = await supabase
        .from(
          "device_runtime"
        )
        .select(
          "runtime_date, runtime_minutes"
        )
        .eq(
          "device_id",
          deviceId
        )
        .gte(
          "runtime_date",
          formatDate(monday)
        )
        .lte(
          "runtime_date",
          formatDate(sunday)
        )
        .order(
          "runtime_date",
          {
            ascending: true,
          }
        );

      /*
        IMPORTANT:
        Give Supabase data
        an explicit TypeScript type.
      */

      const runtimeRows =
        (data ?? []) as RuntimeRow[];

      if (error) {

        console.error(
          "Runtime fetch error:",
          error
        );

        return;
      }

      /*
        Monday -> Sunday
      */

      const days = [
        "Mon",
        "Tue",
        "Wed",
        "Thu",
        "Fri",
        "Sat",
        "Sun",
      ];

      const weeklyData =
        days.map(
          (
            day: string,
            index: number
          ): RuntimeData => {

            const date =
              new Date(
                monday
              );

            date.setDate(
              monday.getDate() +
                index
            );

            const dateString =
              formatDate(
                date
              );

            /*
              Find matching
              database row
            */

            const record =
              runtimeRows.find(
                (
                  item: RuntimeRow
                ) =>
                  item.runtime_date ===
                  dateString
              );

            return {
              day,
              minutes:
                Number(
                  record?.runtime_minutes ??
                    0
                ),
            };
          }
        );

      setRuntimeData(
        weeklyData
      );

    }

    loadRuntimeData();

  }, [deviceId]);

  /* =====================================================
     SAVE CONFIGURATION
  ===================================================== */

  function saveConfiguration() {

    const config = {
      toggles,
      buttons,
      sliders,
    };

    localStorage.setItem(
      `device-${deviceId}-configuration`,
      JSON.stringify(
        config
      )
    );

    setSaved(true);

    setTimeout(() => {
      setSaved(false);
    }, 2000);
  }

  /* =====================================================
     SEND COMMAND
  ===================================================== */

  async function sendCommand(
    command: string
  ) {

    if (sending) {
      return;
    }

    setSending(true);

    try {

      const response =
        await fetch(
          "/api/command",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              device_id:
                deviceId,

              message:
                command,
            }),
          }
        );

      if (!response.ok) {
        throw new Error(
          "Command failed"
        );
      }

    } catch (error) {

      console.error(
        error
      );

      alert(
        "Command send failed"
      );

    } finally {

      setSending(false);

    }
  }

  /* =====================================================
     TOGGLE DEVICE
  ===================================================== */

  async function toggleDevice(
    toggle: ToggleConfig
  ) {

    const currentState =
      motorStates[
        toggle.id
      ] ?? false;

    const command =
      currentState
        ? toggle.offCommand
        : toggle.onCommand;

    await sendCommand(
      command
    );

    setMotorStates(
      (current) => ({
        ...current,

        [toggle.id]:
          !currentState,
      })
    );
  }

  /* =====================================================
     ADD TOGGLE
  ===================================================== */

  function addToggle() {

    const newId =
      Date.now();

    setToggles(
      (current) => [
        ...current,

        {
          id: newId,

          name:
            `Motor ${
              current.length + 1
            }`,

          icon:
            "motor",

          onCommand:
            "M_ON",

          offCommand:
            "M_OFF",

          debounce:
            300,
        },
      ]
    );
  }

  /* =====================================================
     REMOVE TOGGLE
  ===================================================== */

  function removeToggle(
    id: number
  ) {

    setToggles(
      (current) =>
        current.filter(
          (toggle) =>
            toggle.id !== id
        )
    );

    setMotorStates(
      (current) => {

        const copy = {
          ...current,
        };

        delete copy[id];

        return copy;
      }
    );
  }

  /* =====================================================
     ADD BUTTON
  ===================================================== */

  function addButton() {

    setButtons(
      (current) => [
        ...current,

        {
          id:
            Date.now(),

          name:
            `Button ${
              current.length + 1
            }`,

          icon:
            "power",

          command:
            "COMMAND",

          debounce:
            300,
        },
      ]
    );
  }

  /* =====================================================
     REMOVE BUTTON
  ===================================================== */

  function removeButton(
    id: number
  ) {

    setButtons(
      (current) =>
        current.filter(
          (button) =>
            button.id !== id
        )
    );
  }

  /* =====================================================
     ADD SLIDER
  ===================================================== */

  function addSlider() {

    setSliders(
      (current) => [
        ...current,

        {
          id:
            Date.now(),

          name:
            `Slider ${
              current.length + 1
            }`,

          icon:
            "zap",

          command:
            "SPEED",

          min:
            0,

          max:
            100,

          unit:
            "%",
        },
      ]
    );
  }

  /* =====================================================
     REMOVE SLIDER
  ===================================================== */

  function removeSlider(
    id: number
  ) {

    setSliders(
      (current) =>
        current.filter(
          (slider) =>
            slider.id !== id
        )
    );
  }

  /* =====================================================
     UPDATE SLIDER
  ===================================================== */

  function updateSlider(
    id: number,
    field: keyof SliderConfig,
    value: string | number
  ) {

    setSliders(
      (current) =>
        current.map(
          (slider) =>
            slider.id === id
              ? {
                  ...slider,
                  [field]:
                    value,
                }
              : slider
        )
    );
  }

  /* =====================================================
     REQUEST STATUS
  ===================================================== */

  async function requestStatus() {

    await sendCommand(
      "STATUS"
    );
  }

  /* =====================================================
     MAX RUNTIME
  ===================================================== */

  const maxRuntime =
    Math.max(
      ...runtimeData.map(
        (item: RuntimeData) =>
          item.minutes
      ),
      1
    );

  /* =====================================================
     RENDER
  ===================================================== */

  return (

    <main
      style={
        {
          "--theme":
            THEME_COLOR,
        } as React.CSSProperties
      }
      className="min-h-screen bg-[#f7fbfc] px-4 py-6 text-slate-600 sm:px-8"
    >

      <div className="mx-auto max-w-5xl">

        {/* =================================================
            HEADER
        ================================================= */}

        <header className="mb-7 flex items-center justify-between">

          <div>

            <p className="text-xs font-medium text-slate-400">
              DEVICE
            </p>

            <h1 className="mt-1 text-2xl font-semibold text-slate-600">
              {deviceId}
            </h1>

            <p className="mt-1 text-sm text-slate-400">
              Roof Water Controller
            </p>

          </div>

          <button
            onClick={() =>
              setEditMode(
                !editMode
              )
            }
            className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm"
          >

            <Settings
              size={17}
            />

            {editMode
              ? "Done"
              : "Edit"}

          </button>

        </header>

        {/* =================================================
            NORMAL MODE
        ================================================= */}

        {!editMode && (

          <>

            {/* CONTROL GRID */}

            <div className="grid grid-cols-2 gap-4">

              {/* TOGGLES */}

              {toggles.map(
                (
                  toggle: ToggleConfig
                ) => {

                  const isOn =
                    motorStates[
                      toggle.id
                    ] ?? false;

                  return (

                    <div
                      key={
                        toggle.id
                      }
                      className="relative min-h-[190px] rounded-[26px] border border-slate-100 bg-white p-5 shadow-sm transition-all"
                      style={
                        isOn
                          ? {
                              backgroundColor:
                                THEME_COLOR,

                              color:
                                "white",
                            }
                          : {}
                      }
                    >

                      {/* ICON */}

                      <div
                        className="mb-5"
                        style={{
                          color:
                            isOn
                              ? "white"
                              : THEME_COLOR,
                        }}
                      >

                        <DeviceIcon
                          icon={
                            toggle.icon
                          }
                          size={40}
                        />

                      </div>

                      {/* SWITCH */}

                      <button
                        onClick={() =>
                          toggleDevice(
                            toggle
                          )
                        }
                        className="absolute right-5 top-5"
                      >

                        <div
                          className="relative h-7 w-12 rounded-full transition-all"
                          style={{
                            backgroundColor:
                              isOn
                                ? "rgba(255,255,255,.9)"
                                : "#d1d5db",
                          }}
                        >

                          <div
                            className="absolute top-1 h-5 w-5 rounded-full shadow-sm transition-all"
                            style={{
                              left:
                                isOn
                                  ? "25px"
                                  : "4px",

                              backgroundColor:
                                isOn
                                  ? THEME_COLOR
                                  : "#ffffff",
                            }}
                          />

                        </div>

                      </button>

                      {/* NAME */}

                      <p
                        className="text-sm"
                        style={{
                          color:
                            isOn
                              ? "rgba(255,255,255,.7)"
                              : "#a8b3bb",
                        }}
                      >
                        {
                          toggle.name
                        }
                      </p>

                      {/* STATUS */}

                      <p
                        className="mt-1 text-xl font-medium"
                        style={{
                          color:
                            isOn
                              ? "white"
                              : "#718096",
                        }}
                      >
                        {isOn
                          ? "ON"
                          : "OFF"}
                      </p>

                    </div>
                  );
                }
              )}

              {/* BUTTONS */}

              {buttons.map(
                (
                  button: ButtonConfig
                ) => (

                  <button
                    key={
                      button.id
                    }
                    onClick={() =>
                      sendCommand(
                        button.command
                      )
                    }
                    className="relative min-h-[190px] rounded-[26px] border border-slate-100 bg-white p-5 text-left shadow-sm"
                  >

                    <div
                      className="mb-5"
                      style={{
                        color:
                          THEME_COLOR,
                      }}
                    >

                      <DeviceIcon
                        icon={
                          button.icon
                        }
                        size={40}
                      />

                    </div>

                    <p className="text-sm text-slate-400">
                      {
                        button.name
                      }
                    </p>

                    <p className="mt-1 text-xl font-medium text-slate-500">
                      READY
                    </p>

                  </button>
                )
              )}

            </div>

            {/* =================================================
                SLIDERS
            ================================================= */}

            {sliders.map(
              (
                slider: SliderConfig
              ) => {

                const value =
                  sliderValues[
                    slider.id
                  ] ??
                  slider.min;

                return (

                  <div
                    key={
                      slider.id
                    }
                    className="mt-4 rounded-[26px] border border-slate-100 bg-white p-5 shadow-sm"
                  >

                    <div className="mb-5 flex items-center justify-between">

                      <div className="flex items-center gap-3">

                        <div
                          style={{
                            color:
                              THEME_COLOR,
                          }}
                        >

                          <DeviceIcon
                            icon={
                              slider.icon
                            }
                            size={32}
                          />

                        </div>

                        <div>

                          <p className="text-sm text-slate-400">
                            {
                              slider.name
                            }
                          </p>

                          <p className="text-xl font-medium text-slate-500">
                            {value}
                            {
                              slider.unit
                            }
                          </p>

                        </div>

                      </div>

                    </div>

                    <input
                      type="range"
                      min={
                        slider.min
                      }
                      max={
                        slider.max
                      }
                      value={
                        value
                      }
                      onChange={(
                        e
                      ) => {

                        const newValue =
                          Number(
                            e.target
                              .value
                          );

                        setSliderValues(
                          (
                            current
                          ) => ({
                            ...current,

                            [slider.id]:
                              newValue,
                          })
                        );

                        sendCommand(
                          `${slider.command}:${newValue}`
                        );

                      }}
                      className="w-full"
                      style={{
                        accentColor:
                          THEME_COLOR,
                      }}
                    />

                  </div>
                );
              }
            )}

            {/* =================================================
                WEEKLY RUNTIME
            ================================================= */}

            <div className="mt-4 rounded-[26px] border border-slate-100 bg-white p-5 shadow-sm">

              <div className="mb-6">

                <p className="text-sm text-slate-400">
                  Motor Runtime
                </p>

                <h2 className="text-xl font-medium text-slate-500">
                  This Week
                </h2>

              </div>

              <div className="flex h-48 items-end justify-between gap-2">

                {runtimeData.map(
                  (
                    item: RuntimeData
                  ) => {

                    const height =
                      item.minutes >
                      0
                        ? (
                            item.minutes /
                            maxRuntime
                          ) *
                          100
                        : 0;

                    return (

                      <div
                        key={
                          item.day
                        }
                        className="flex h-full flex-1 flex-col items-center justify-end"
                      >

                        <span className="mb-2 text-xs text-slate-400">
                          {
                            item.minutes
                          }m
                        </span>

                        <div
                          className="w-full max-w-[38px] rounded-t-xl transition-all"
                          style={{
                            height:
                              `${height}%`,

                            backgroundColor:
                              THEME_COLOR,
                          }}
                        />

                        <span className="mt-3 text-xs text-slate-400">
                          {
                            item.day
                          }
                        </span>

                      </div>
                    );
                  }
                )}

              </div>

            </div>

            {/* =================================================
                DEVICE STATUS
            ================================================= */}

            <div className="mt-4 rounded-[26px] border border-slate-100 bg-white p-5 shadow-sm">

              <div className="mb-4 flex items-center gap-3">

                <div
                  style={{
                    color:
                      THEME_COLOR,
                  }}
                >

                  <Radio
                    size={28}
                  />

                </div>

                <div>

                  <p className="text-sm text-slate-400">
                    Device Status
                  </p>

                  <p className="text-base font-medium text-slate-500">
                    Get actual status from ESP
                  </p>

                </div>

              </div>

              <button
                disabled={
                  sending
                }
                onClick={
                  requestStatus
                }
                className="w-full rounded-2xl py-4 font-semibold text-white shadow-sm"
                style={{
                  backgroundColor:
                    THEME_COLOR,
                }}
              >

                {sending
                  ? "Requesting..."
                  : "GET CURRENT STATUS"}

              </button>

            </div>

          </>
        )}

        {/* =================================================
            EDIT MODE
        ================================================= */}

        {editMode && (

          <div className="space-y-5">

            {/* =================================================
                TOGGLES
            ================================================= */}

            <section className="rounded-[26px] bg-white p-5 shadow-sm">

              <div className="mb-5 flex items-center justify-between">

                <h2 className="text-lg font-semibold">
                  Toggle Controls
                </h2>

                <button
                  onClick={
                    addToggle
                  }
                  className="flex items-center gap-2 rounded-xl px-4 py-2 text-white"
                  style={{
                    backgroundColor:
                      THEME_COLOR,
                  }}
                >

                  <Plus
                    size={17}
                  />

                  Add

                </button>

              </div>

              {toggles.map(
                (
                  toggle: ToggleConfig
                ) => (

                  <div
                    key={
                      toggle.id
                    }
                    className="mb-4 space-y-3 rounded-2xl border border-slate-100 p-4"
                  >

                    {/* TOP */}

                    <div className="flex items-center justify-between">

                      <p className="text-sm font-semibold text-slate-500">
                        {
                          toggle.name
                        }
                      </p>

                      <button
                        type="button"
                        onClick={() =>
                          removeToggle(
                            toggle.id
                          )
                        }
                        className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-red-500"
                      >

                        <Trash2
                          size={16}
                        />

                        Remove

                      </button>

                    </div>

                    {/* NAME */}

                    <input
                      value={
                        toggle.name
                      }
                      onChange={(
                        e
                      ) =>
                        setToggles(
                          (
                            current
                          ) =>
                            current.map(
                              (
                                item: ToggleConfig
                              ) =>
                                item.id ===
                                toggle.id
                                  ? {
                                      ...item,

                                      name:
                                        e
                                          .target
                                          .value,
                                    }
                                  : item
                            )
                        )
                      }
                      placeholder="Name"
                      className="w-full rounded-xl border border-slate-200 p-3 outline-none"
                    />

                    {/* ICON */}

                    <div>

                      <p className="mb-2 text-xs font-medium text-slate-400">
                        Icon
                      </p>

                      <IconPicker
                        value={
                          toggle.icon
                        }
                        onChange={(
                          icon
                        ) =>
                          setToggles(
                            (
                              current
                            ) =>
                              current.map(
                                (
                                  item: ToggleConfig
                                ) =>
                                  item.id ===
                                  toggle.id
                                    ? {
                                        ...item,
                                        icon,
                                      }
                                    : item
                              )
                          )
                        }
                      />

                    </div>

                    {/* ON COMMAND */}

                    <input
                      value={
                        toggle.onCommand
                      }
                      onChange={(
                        e
                      ) =>
                        setToggles(
                          (
                            current
                          ) =>
                            current.map(
                              (
                                item: ToggleConfig
                              ) =>
                                item.id ===
                                toggle.id
                                  ? {
                                      ...item,

                                      onCommand:
                                        e
                                          .target
                                          .value,
                                    }
                                  : item
                            )
                        )
                      }
                      placeholder="ON Command"
                      className="w-full rounded-xl border border-slate-200 p-3"
                    />

                    {/* OFF COMMAND */}

                    <input
                      value={
                        toggle.offCommand
                      }
                      onChange={(
                        e
                      ) =>
                        setToggles(
                          (
                            current
                          ) =>
                            current.map(
                              (
                                item: ToggleConfig
                              ) =>
                                item.id ===
                                toggle.id
                                  ? {
                                      ...item,

                                      offCommand:
                                        e
                                          .target
                                          .value,
                                    }
                                  : item
                            )
                        )
                      }
                      placeholder="OFF Command"
                      className="w-full rounded-xl border border-slate-200 p-3"
                    />

                    {/* DEBOUNCE */}

                    <input
                      type="number"
                      value={
                        toggle.debounce
                      }
                      onChange={(
                        e
                      ) =>
                        setToggles(
                          (
                            current
                          ) =>
                            current.map(
                              (
                                item: ToggleConfig
                              ) =>
                                item.id ===
                                toggle.id
                                  ? {
                                      ...item,

                                      debounce:
                                        Number(
                                          e
                                            .target
                                            .value
                                        ),
                                    }
                                  : item
                            )
                        )
                      }
                      placeholder="Debounce"
                      className="w-full rounded-xl border border-slate-200 p-3"
                    />

                  </div>
                )
              )}

            </section>

            {/* =================================================
                BUTTONS
            ================================================= */}

            <section className="rounded-[26px] bg-white p-5 shadow-sm">

              <div className="mb-5 flex items-center justify-between">

                <h2 className="text-lg font-semibold">
                  Buttons
                </h2>

                <button
                  onClick={
                    addButton
                  }
                  className="flex items-center gap-2 rounded-xl px-4 py-2 text-white"
                  style={{
                    backgroundColor:
                      THEME_COLOR,
                  }}
                >

                  <Plus
                    size={17}
                  />

                  Add

                </button>

              </div>

              {buttons.map(
                (
                  button: ButtonConfig
                ) => (

                  <div
                    key={
                      button.id
                    }
                    className="mb-4 rounded-2xl border border-slate-100 p-4"
                  >

                    <div className="mb-3 flex justify-end">

                      <button
                        type="button"
                        onClick={() =>
                          removeButton(
                            button.id
                          )
                        }
                        className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-red-500"
                      >

                        <Trash2
                          size={16}
                        />

                        Remove

                      </button>

                    </div>

                    {/* NAME */}

                    <input
                      value={
                        button.name
                      }
                      onChange={(
                        e
                      ) =>
                        setButtons(
                          (
                            current
                          ) =>
                            current.map(
                              (
                                item: ButtonConfig
                              ) =>
                                item.id ===
                                button.id
                                  ? {
                                      ...item,

                                      name:
                                        e
                                          .target
                                          .value,
                                    }
                                  : item
                            )
                        )
                      }
                      placeholder="Button Name"
                      className="mb-3 w-full rounded-xl border border-slate-200 p-3"
                    />

                    {/* ICON */}

                    <div className="mb-3">

                      <p className="mb-2 text-xs font-medium text-slate-400">
                        Icon
                      </p>

                      <IconPicker
                        value={
                          button.icon
                        }
                        onChange={(
                          icon
                        ) =>
                          setButtons(
                            (
                              current
                            ) =>
                              current.map(
                                (
                                  item: ButtonConfig
                                ) =>
                                  item.id ===
                                  button.id
                                    ? {
                                        ...item,
                                        icon,
                                      }
                                    : item
                              )
                          )
                        }
                      />

                    </div>

                    {/* COMMAND */}

                    <input
                      value={
                        button.command
                      }
                      onChange={(
                        e
                      ) =>
                        setButtons(
                          (
                            current
                          ) =>
                            current.map(
                              (
                                item: ButtonConfig
                              ) =>
                                item.id ===
                                button.id
                                  ? {
                                      ...item,

                                      command:
                                        e
                                          .target
                                          .value,
                                    }
                                  : item
                            )
                        )
                      }
                      placeholder="Command"
                      className="mb-3 w-full rounded-xl border border-slate-200 p-3"
                    />

                    {/* DEBOUNCE */}

                    <input
                      type="number"
                      value={
                        button.debounce
                      }
                      onChange={(
                        e
                      ) =>
                        setButtons(
                          (
                            current
                          ) =>
                            current.map(
                              (
                                item: ButtonConfig
                              ) =>
                                item.id ===
                                button.id
                                  ? {
                                      ...item,

                                      debounce:
                                        Number(
                                          e
                                            .target
                                            .value
                                        ),
                                    }
                                  : item
                            )
                        )
                      }
                      placeholder="Debounce"
                      className="mb-3 w-full rounded-xl border border-slate-200 p-3"
                    />

                  </div>
                )
              )}

            </section>

            {/* =================================================
                SLIDERS
            ================================================= */}

            <section className="rounded-[26px] bg-white p-5 shadow-sm">

              <div className="mb-5 flex items-center justify-between">

                <h2 className="text-lg font-semibold">
                  Sliders
                </h2>

                <button
                  onClick={
                    addSlider
                  }
                  className="flex items-center gap-2 rounded-xl px-4 py-2 text-white"
                  style={{
                    backgroundColor:
                      THEME_COLOR,
                  }}
                >

                  <Plus
                    size={17}
                  />

                  Add

                </button>

              </div>

              {sliders.map(
                (
                  slider: SliderConfig
                ) => (

                  <div
                    key={
                      slider.id
                    }
                    className="mb-4 rounded-2xl border border-slate-100 p-4"
                  >

                    <div className="mb-3 flex justify-end">

                      <button
                        type="button"
                        onClick={() =>
                          removeSlider(
                            slider.id
                          )
                        }
                        className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-red-500"
                      >

                        <Trash2
                          size={16}
                        />

                        Remove

                      </button>

                    </div>

                    {/* NAME */}

                    <input
                      value={
                        slider.name
                      }
                      onChange={(
                        e
                      ) =>
                        updateSlider(
                          slider.id,
                          "name",
                          e.target.value
                        )
                      }
                      placeholder="Slider Name"
                      className="mb-3 w-full rounded-xl border border-slate-200 p-3"
                    />

                    {/* ICON */}

                    <div className="mb-3">

                      <p className="mb-2 text-xs font-medium text-slate-400">
                        Icon
                      </p>

                      <IconPicker
                        value={
                          slider.icon
                        }
                        onChange={(
                          icon
                        ) =>
                          updateSlider(
                            slider.id,
                            "icon",
                            icon
                          )
                        }
                      />

                    </div>

                    {/* COMMAND */}

                    <input
                      value={
                        slider.command
                      }
                      onChange={(
                        e
                      ) =>
                        updateSlider(
                          slider.id,
                          "command",
                          e.target.value
                        )
                      }
                      placeholder="Command"
                      className="mb-3 w-full rounded-xl border border-slate-200 p-3"
                    />

                    {/* MIN MAX UNIT */}

                    <div className="grid grid-cols-3 gap-2">

                      <input
                        type="number"
                        value={
                          slider.min
                        }
                        onChange={(
                          e
                        ) =>
                          updateSlider(
                            slider.id,
                            "min",
                            Number(
                              e
                                .target
                                .value
                            )
                          )
                        }
                        placeholder="Min"
                        className="rounded-xl border border-slate-200 p-3"
                      />

                      <input
                        type="number"
                        value={
                          slider.max
                        }
                        onChange={(
                          e
                        ) =>
                          updateSlider(
                            slider.id,
                            "max",
                            Number(
                              e
                                .target
                                .value
                            )
                          )
                        }
                        placeholder="Max"
                        className="rounded-xl border border-slate-200 p-3"
                      />

                      <input
                        value={
                          slider.unit
                        }
                        onChange={(
                          e
                        ) =>
                          updateSlider(
                            slider.id,
                            "unit",
                            e.target.value
                          )
                        }
                        placeholder="Unit"
                        className="rounded-xl border border-slate-200 p-3"
                      />

                    </div>

                  </div>
                )
              )}

            </section>

            {/* =================================================
                SAVE
            ================================================= */}

            <button
              onClick={
                saveConfiguration
              }
              className="w-full rounded-2xl py-4 font-semibold text-white"
              style={{
                backgroundColor:
                  THEME_COLOR,
              }}
            >

              {saved
                ? "✓ Saved"
                : "💾 Save Configuration"}

            </button>

          </div>
        )}

      </div>

    </main>
  );
}