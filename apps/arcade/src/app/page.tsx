import { HeroMedia } from '@/components/HeroMedia';
import Link from 'next/link';

export default function Home() {
  return (
    <>
      {/* Hero Section */}
      <section className="relative min-h-[80vh] flex items-center">
        <HeroMedia
          videoSrc="/hero/reach-hero.mp4"
          fallbackSrc="/hero/reach-hero-fallback.png"
          className="absolute inset-0"
        />
        
        <div className="section-container relative z-10 py-20">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20 mb-6">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-sm text-gray-300">Global Orchestration Network Online</span>
            </div>
            
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
              Orchestrate{' '}
              <span className="text-gradient">Intelligence</span>
              <br />
              At Global Scale
            </h1>
            
            <p className="text-xl text-gray-400 mb-8 max-w-2xl">
              Build, deploy, and govern distributed AI agents across the world's most reliable 
              orchestration infrastructure. From edge to cloud, one platform.
            </p>
            
            <div className="flex flex-wrap gap-4">
              <Link href="/studio" className="btn-primary text-lg">
                Launch Studio
              </Link>
              <Link href="/marketplace" className="btn-secondary text-lg">
                Explore Marketplace
              </Link>
            </div>
            
            {/* Stats */}
            <div className="grid grid-cols-3 gap-8 mt-16 pt-8 border-t border-white/10">
              <div>
                <div className="text-3xl font-bold text-gradient">99.99%</div>
                <div className="text-sm text-gray-500">Uptime SLA</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-gradient">150+</div>
                <div className="text-sm text-gray-500">Global Nodes</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-gradient">&lt;50ms</div>
                <div className="text-sm text-gray-500">Latency</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 bg-surface/30">
        <div className="section-container">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">How It Works</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              From concept to global deployment in three simple steps
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: 'Design',
                description: 'Compose agent workflows in our visual studio. Connect pre-built components or create custom agents.',
                icon: '🎨',
              },
              {
                step: '02',
                title: 'Deploy',
                description: 'Push to our global edge network. Automatic scaling, load balancing, and health monitoring included.',
                icon: '🚀',
              },
              {
                step: '03',
                title: 'Govern',
                description: 'Manage permissions, audit trails, and compliance policies across your entire agent ecosystem.',
                icon: '🛡️',
              },
            ].map((item) => (
              <div key={item.step} className="card gradient-border">
                <div className="text-4xl mb-4">{item.icon}</div>
                <div className="text-sm font-mono text-accent mb-2">{item.step}</div>
                <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                <p className="text-gray-400 text-sm">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24">
        <div className="section-container">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Platform Capabilities</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Everything you need to build production-grade agent systems
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                title: 'Global Orchestration',
                description: 'Distribute workloads across 150+ edge locations with intelligent routing.',
                href: '/dashboard',
              },
              {
                title: 'Agent Marketplace',
                description: 'Discover and deploy pre-built agents from the community and verified publishers.',
                href: '/marketplace',
              },
              {
                title: 'Visual Studio',
                description: 'Design complex workflows with our drag-and-drop orchestration builder.',
                href: '/studio',
              },
              {
                title: 'Enterprise Governance',
                description: 'Role-based access, audit logs, and compliance policies at every layer.',
                href: '/governance',
              },
              {
                title: 'Real-time Monitoring',
                description: 'Track performance, costs, and agent behavior across your deployment.',
                href: '/dashboard',
              },
              {
                title: 'Secure Execution',
                description: 'Sandboxed environments with policy enforcement and encrypted channels.',
                href: '/governance',
              },
            ].map((feature) => (
              <Link
                key={feature.title}
                href={feature.href}
                className="card group hover:border-accent/50 transition-all"
              >
                <h3 className="font-bold mb-2 group-hover:text-accent transition-colors">
                  {feature.title}
                </h3>
                <p className="text-gray-400 text-sm">{feature.description}</p>
                <div className="mt-4 flex items-center text-accent text-sm font-medium">
                  Learn more
                  <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-accent/5 to-transparent" />
        <div className="section-container relative z-10">
          <div className="card max-w-3xl mx-auto text-center p-12 gradient-border">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to orchestrate?
            </h2>
            <p className="text-gray-400 mb-8 max-w-lg mx-auto">
              Join thousands of developers building the future of distributed intelligence.
              Start free, scale as you grow.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link href="/studio" className="btn-primary">
                Get Started Free
              </Link>
              <Link href="/contact" className="btn-secondary">
                Talk to Sales
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}