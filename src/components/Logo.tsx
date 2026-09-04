import { Zap } from "lucide-react";

export function Logo({ size = "lg" }: { size?: "sm" | "lg" }) {
  const isLg = size === "lg";
  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className={`flex items-center justify-center rounded-2xl bg-primary shadow-glow ${
          isLg ? "size-20" : "size-10"
        }`}
      >
        <Zap className={isLg ? "size-10" : "size-5"} strokeWidth={2.4} />
      </div>
      <div className="text-center">
        <p className={`font-display font-semibold ${isLg ? "text-3xl" : "text-lg"}`}>
          <span className="text-gradient">ServiHub</span>
        </p>
        {isLg && (
          <p className="mt-1 text-sm text-muted-foreground">
            Serviços sob demanda, perto de você
          </p>
        )}
      </div>
    </div>
  );
}
