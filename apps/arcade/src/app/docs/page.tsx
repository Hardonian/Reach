export default function Docs() {
  const sections = [
    {
      title: 'Getting Started',
      items: [
        { title: 'Quick Start', href: '#quick-start' },
        { title: 'Installation', href: '#installation' },
        { title: 'Configuration', href: '#configuration' },
      ],
    },
    {
      title: 'Core Concepts',
      items: [
        { title: 'Agents', href: '#agents' },
        { title: 'Pipelines', href: '#pipelines' },
        { title: 'Orchestration', href: '#orchestration' },
        { title: 'Governance', href: '#governance' },
      ],
    },
    {
      title: 'Platform',
      items: [
        { title: 'Dashboard', href: '#dashboard' },
        { title: 'Marketplace', href: '#marketplace' },
        { title: 'Studio', href: '#studio' },
      ],
    },
    {
      title: 'API Reference',
      items: [
        { title: 'Authentication', href: '#auth' },
        { title: 'Endpoints', href: '#endpoints' },
        { title: 'Webhooks', href: '#webhooks' },
      ],
    },
  ];

  return (
    <div className="section-container py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-4">Documentation</h1>
        <p className="text-gray-400 mb-12">
          Learn how to build, deploy, and orchestrate agents at global scale.
        </p>

        <div className="grid md:grid-cols-2 gap-6">
          {sections.map((section) => (
            <div key={section.title} className="card">
              <h2 className="text-xl font-bold mb-4">{section.title}</h2>
              <ul className="space-y-2">
                {section.items.map((item) => (
                  <li key={item.title}>
                    <a
                      href={item.href}
                      className="text-gray-400 hover:text-white transition-colors flex items-center gap-2"
                    >
                      <span className="text-accent">→</span>
                      {item.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 card gradient-border">
          <h2 className="text-xl font-bold mb-4">Need Help?</h2>
          <p className="text-gray-400 mb-4">
            Can't find what you're looking for? Reach out to our support team or join the community.
          </p>
          <div className="flex gap-4">
            <a href="/contact" className="btn-primary text-sm py-2">Contact Support</a>
            <a href="https://github.com" className="btn-secondary text-sm py-2">GitHub Discussions</a>
          </div>
        </div>
      </div>
    </div>
  );
}