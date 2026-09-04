export function Logo({ size = "lg" }: { size?: "sm" | "lg" }) {
  const isLg = size === "lg";
  return (
    <div className="flex flex-col items-center gap-3">
      <img
        src="/logo-cataputa.png"
        alt="CataPuta Web"
        className={`object-contain ${isLg ? "size-24" : "size-10"}`}
      />
      {isLg && (
        <div className="text-center">
          <p className="font-display text-3xl font-bold">
            <span className="text-gradient">CataPuta</span>
            <span className="text-muted-foreground"> Web</span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Serviços sob demanda, sem rodeios.
          </p>
        </div>
      )}
    </div>
  );
}
