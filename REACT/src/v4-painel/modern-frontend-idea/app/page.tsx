import Link from "next/link"
import { TrendingUp, ArrowRight, BarChart3, Layers, Users, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function Page() {
  return (
    <main className="relative flex min-h-screen flex-col bg-background">
      {/* Background Pattern */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,transparent_0%,transparent_49%,var(--border)_49%,var(--border)_51%,transparent_51%,transparent_100%)] bg-[length:80px_80px] opacity-10" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_0%,transparent_49%,var(--border)_49%,var(--border)_51%,transparent_51%,transparent_100%)] bg-[length:80px_80px] opacity-10" />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5" />
      </div>

      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 md:px-12">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <TrendingUp className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold">InMidia</span>
        </div>
        <nav className="flex items-center gap-4">
          <Link href="/login">
            <Button variant="ghost" size="sm">
              Entrar
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button size="sm" className="gap-2">
              Dashboard
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
        <div className="mx-auto max-w-3xl space-y-8">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/50 px-4 py-1.5 text-sm backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            <span className="text-muted-foreground">Novo: Dashboard V5 com IA integrada</span>
          </div>

          {/* Heading */}
          <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            Gestao inteligente de{" "}
            <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              midia exterior
            </span>
          </h1>

          {/* Subheading */}
          <p className="mx-auto max-w-2xl text-pretty text-lg text-muted-foreground">
            Plataforma completa para gerenciar placas, contratos, campanhas e 
            relatorios. Tome decisoes baseadas em dados com visualizacoes em tempo real.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link href="/dashboard">
              <Button size="lg" className="gap-2">
                Acessar Dashboard
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" size="lg">
                Fazer Login
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="border-t border-border bg-card/50 px-6 py-20 backdrop-blur-sm">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            <FeatureCard
              icon={Layers}
              title="Gestao de Placas"
              description="Controle total sobre seu inventario de placas e outdoors"
            />
            <FeatureCard
              icon={BarChart3}
              title="Relatorios"
              description="Dashboards e analises em tempo real para decisoes rapidas"
            />
            <FeatureCard
              icon={Users}
              title="CRM Integrado"
              description="Gestao de clientes e contratos em uma unica plataforma"
            />
            <FeatureCard
              icon={Shield}
              title="Seguranca"
              description="Dados protegidos com criptografia e backups automaticos"
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between text-sm text-muted-foreground">
          <p>2024 InMidia. Todos os direitos reservados.</p>
          <div className="flex items-center gap-4">
            <Link href="/terms" className="hover:text-foreground">
              Termos
            </Link>
            <Link href="/privacy" className="hover:text-foreground">
              Privacidade
            </Link>
          </div>
        </div>
      </footer>
    </main>
  )
}

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType
  title: string
  description: string
}) {
  return (
    <div className="group space-y-3 rounded-lg border border-border bg-background p-6 transition-colors hover:bg-accent/50">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  )
}
