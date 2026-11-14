import { useCallback, useEffect, useState } from "react";

import type { Service } from "react-native-zeroconf";

export type DiscoveredClassroomDevice = {
  name: string;
  deviceId: string;
  deviceName: string;
  classId?: string;
  className?: string;
  baseUrls: string[];
};

function classroomDevice(service: Service): DiscoveredClassroomDevice | null {
  const deviceId = service.txt.deviceId?.trim();
  if (!deviceId || !service.port) return null;
  const addresses = (service.ipv4.length ? service.ipv4 : service.addresses)
    .filter((address) => address && !address.includes(":"))
    .map((address) => `http://${address}:${service.port}`);
  if (!addresses.length) return null;
  return {
    name: service.name,
    deviceId,
    deviceName: service.txt.deviceName || service.name,
    classId: service.txt.classId || undefined,
    className: service.txt.className || undefined,
    baseUrls: [...new Set(addresses)],
  };
}

export function useClassroomDiscovery() {
  const [devices, setDevices] = useState<DiscoveredClassroomDevice[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generation, setGeneration] = useState(0);
  const restart = useCallback(() => setGeneration((value) => value + 1), []);

  useEffect(() => {
    let disposed = false;
    let zeroconf: import("react-native-zeroconf").default | null = null;
    setDevices([]); setError(null); setIsScanning(true);

    void import("react-native-zeroconf").then(async ({ default: Zeroconf }) => {
      if (disposed) return;
      zeroconf = new Zeroconf();
      zeroconf.on("resolved", (service) => {
        const device = classroomDevice(service);
        if (!device || disposed) return;
        setDevices((current) => [...current.filter((item) => item.name !== device.name), device].sort((a, b) => a.deviceName.localeCompare(b.deviceName, "zh-CN")));
      });
      zeroconf.on("remove", (name) => setDevices((current) => current.filter((item) => item.name !== name)));
      zeroconf.on("start", () => setIsScanning(true));
      zeroconf.on("stop", () => setIsScanning(false));
      zeroconf.on("error", (event) => setError(event.message || "局域网设备发现失败"));
      const access = await zeroconf.checkLocalNetworkAccess({ type: "bigfatfish", protocol: "tcp" });
      if (disposed) return;
      if (access === "denied") {
        setError("没有局域网访问权限，请在系统设置中允许大肥鱼访问本地网络");
        setIsScanning(false);
        return;
      }
      zeroconf.scan({ type: "bigfatfish", protocol: "tcp", resolveTimeout: 3 });
    }).catch(() => {
      if (!disposed) {
        setError("当前应用构建不包含局域网发现模块，可使用扫码或手工填写地址");
        setIsScanning(false);
      }
    });

    return () => {
      disposed = true;
      if (zeroconf) {
        try { zeroconf.stop(); } catch { /* scan may not have started */ }
        zeroconf.removeDeviceListeners();
      }
    };
  }, [generation]);

  return { devices, error, isScanning, restart };
}
