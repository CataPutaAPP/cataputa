export function Logo({ size = "lg" }: { size?: "sm" | "lg" }) {
  const isLg = size === "lg";
  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className={`overflow-hidden rounded-full bg-[#1A1A1A] shadow-lg ${
          isLg ? "size-32 shadow-primary/30" : "size-11 shadow-primary/20"
        }`}
      >
        <img
          src="/logo-cataputa.png"
          alt="CataPuta Web"
          className="size-full scale-110 object-cover"
        />
      </div>
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
