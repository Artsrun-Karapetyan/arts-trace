export function severityByCount(count: number): "high" | "mid" {
  return count >= 5 ? "high" : "mid";
}
