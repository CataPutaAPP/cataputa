export function Logo({ size = "lg" }: { size?: "sm" | "lg" }) {
  const isLg = size === "lg";
  return (
    <div className="flex flex-col items-center gap-4">
      <img
        src="/logo-cataputa.png"
        alt="CataPuta Web"
        className={`object-contain drop-shadow-lg ${
          isLg ? "size-36" : "size-11"
        }`}
        style={isLg ? { filter: "drop-shadow(0 8px 24px rgba(150, 26, 25, 0.4))" } : undefined}
      />
      {isLg && (
        <div className="text-center">
          <h1 className="font-display text-4xl font-bold tracking-tight">
            <span className="text-gradient">CataPuta</span>
            <span className="text-muted-foreground"> Web</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Serviços sob demanda, sem rodeios.
          </p>
        </div>
      )}
    </div>
  );
}
