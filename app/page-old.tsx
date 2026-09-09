export default function Home() {
  const devices = [
    {
      id: "ESP001",
      name: "Roof Water Controller",
      online: true,
      status: "Running",
      motor1: true,
      motor2: false,
      tank: 72,
    },
    {
      id: "ESP002",
      name: "Garden Controller",
      online: true,
      status: "Idle",
      motor1: false,
      motor2: true,
      tank: 48,
    },
    {
      id: "ESP003",
      name: "Garage Controller",
      online: false,
      status: "Offline",
      motor1: false,
      motor2: false,
      tank: 0,
    },
  ];

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-6 py-8">

        {/* Header */}
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">
              ⚡ ESP Control Center
            </h1>
            <p className="mt-1 text-slate-400">
              Master Dashboard
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-sm">
            System Online
            <span className="ml-2 text-green-400">●</span>
          </div>
        </header>

        {/* Summary */}
        <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat title="Total ESPs" value="3" />
          <Stat title="Online" value="2" />
          <Stat title="Offline" value="1" />
          <Stat title="Active Motors" value="2" />
        </section>

        {/* Devices */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              Devices
            </h2>

            <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500">
              + Add Device
            </button>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {devices.map((device) => (
              <DeviceCard key={device.id} device={device} />
            ))}
          </div>
        </section>

      </div>
    </main>
  );
}

function Stat({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <p className="text-sm text-slate-400">{title}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  );
}

function DeviceCard({ device }: { device: any }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">

      {/* Device Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-slate-500">
            {device.id}
          </p>

          <h3 className="mt-1 font-semibold">
            {device.name}
          </h3>
        </div>

        <span
          className={`rounded-full px-3 py-1 text-xs ${
            device.online
              ? "bg-green-500/10 text-green-400"
              : "bg-red-500/10 text-red-400"
          }`}
        >
          ● {device.online ? "ONLINE" : "OFFLINE"}
        </span>
      </div>

      {/* Status */}
      <div className="mt-5 rounded-xl bg-slate-950 p-4">
        <p className="text-xs text-slate-500">
          Current Status
        </p>

        <p className="mt-1 font-medium">
          {device.status}
        </p>
      </div>

      {/* Motors */}
      <div className="mt-4 grid grid-cols-2 gap-3">

        <div className="rounded-xl border border-slate-800 p-3">
          <p className="text-xs text-slate-500">
            Motor 1
          </p>

          <p className="mt-1 font-medium">
            <span
              className={
                device.motor1
                  ? "text-green-400"
                  : "text-slate-500"
              }
            >
              ● {device.motor1 ? "ON" : "OFF"}
            </span>
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 p-3">
          <p className="text-xs text-slate-500">
            Motor 2
          </p>

          <p className="mt-1 font-medium">
            <span
              className={
                device.motor2
                  ? "text-green-400"
                  : "text-slate-500"
              }
            >
              ● {device.motor2 ? "ON" : "OFF"}
            </span>
          </p>
        </div>

      </div>

      {/* Tank */}
      <div className="mt-4">
        <div className="mb-2 flex justify-between text-xs">
          <span className="text-slate-400">
            Tank Level
          </span>

          <span>{device.tank}%</span>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-blue-500"
            style={{ width: `${device.tank}%` }}
          />
        </div>
      </div>

      {/* Open */}
      <button className="mt-5 w-full rounded-xl border border-slate-700 py-2 text-sm hover:bg-slate-800">
        Open Device
      </button>

    </div>
  );
}