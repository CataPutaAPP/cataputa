export function Logo({ size = "lg" }: { size?: "sm" | "lg" }) {
  const isLg = size === "lg";
  return (
    <div className="flex flex-col items-center gap-4">
      <img
        src="/privora-selo.png"
        alt="Privora Private Club"
        className={`object-contain ${isLg ? "size-36" : "size-11"}`}
        style={isLg ? { filter: "drop-shadow(0 10px 28px rgba(216, 184, 144, 0.28))" } : undefined}
      />
      {isLg && (
        <div className="text-center">
          <h1 className="font-display text-4xl font-semibold tracking-[0.18em] text-primary">
            PRIVORA
          </h1>
          <p className="mt-1 text-[11px] uppercase tracking-[0.34em] text-muted-foreground">
            Private Club
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            Acesso reservado. Discrição em primeiro lugar.
          </p>
        </div>
      )}
    </div>
  );
}
