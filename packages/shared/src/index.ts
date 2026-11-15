export type HealthStatus = {
  status: "ok" | "error";
  service: string;
  timestamp: string;
};
