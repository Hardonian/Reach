'use client';

import { useState } from 'react';

export default function Contact() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    message: '',
    interest: 'general',
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="section-container py-16">
        <div className="max-w-md mx-auto text-center">
          <div className="text-6xl mb-4">✅</div>
          <h1 className="text-3xl font-bold mb-4">Message Sent!</h1>
          <p className="text-gray-400 mb-8">
            Thank you for reaching out. We'll get back to you within 24 hours.
          </p>
          <a href="/" className="btn-primary">Return Home</a>
        </div>
      </div>
    );
  }

  return (
    <div className="section-container py-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Contact Us</h1>
          <p className="text-gray-400">
            Have questions? We'd love to hear from you.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-12">
          {/* Contact Form */}
          <div className="card">
            <h2 className="text-xl font-bold mb-6">Send a Message</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Name</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-3 rounded-lg bg-surface border border-border text-white placeholder-gray-500 focus:outline-none focus:border-accent"
                  placeholder="Your name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Email</label>
                <input
                  type="email"
                  required
                  className="w-full px-4 py-3 rounded-lg bg-surface border border-border text-white placeholder-gray-500 focus:outline-none focus:border-accent"
                  placeholder="you@company.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Company</label>
                <input
                  type="text"
                  className="w-full px-4 py-3 rounded-lg bg-surface border border-border text-white placeholder-gray-500 focus:outline-none focus:border-accent"
                  placeholder="Your company (optional)"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Interest</label>
                <select
                  className="w-full px-4 py-3 rounded-lg bg-surface border border-border text-white focus:outline-none focus:border-accent"
                  value={formData.interest}
                  onChange={(e) => setFormData({ ...formData, interest: e.target.value })}
                >
                  <option value="general">General Inquiry</option>
                  <option value="sales">Sales / Enterprise</option>
                  <option value="support">Technical Support</option>
                  <option value="partners">Partnerships</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Message</label>
                <textarea
                  required
                  rows={4}
                  className="w-full px-4 py-3 rounded-lg bg-surface border border-border text-white placeholder-gray-500 focus:outline-none focus:border-accent"
                  placeholder="How can we help?"
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                />
              </div>

              <button type="submit" className="w-full btn-primary">
                Send Message
              </button>
            </form>
          </div>

          {/* Contact Info */}
          <div className="space-y-6">
            <div className="card">
              <h3 className="font-bold mb-2">📧 Email</h3>
              <p className="text-gray-400">hello@reach.io</p>
              <p className="text-sm text-gray-500 mt-1">For general inquiries</p>
            </div>

            <div className="card">
              <h3 className="font-bold mb-2">💼 Sales</h3>
              <p className="text-gray-400">sales@reach.io</p>
              <p className="text-sm text-gray-500 mt-1">For enterprise inquiries</p>
            </div>

            <div className="card">
              <h3 className="font-bold mb-2">🛟 Support</h3>
              <p className="text-gray-400">support@reach.io</p>
              <p className="text-sm text-gray-500 mt-1">For technical assistance</p>
            </div>

            <div className="card">
              <h3 className="font-bold mb-4">🌐 Connect</h3>
              <div className="flex gap-4">
                <a href="https://github.com" className="text-gray-400 hover:text-white transition-colors">
                  GitHub
                </a>
                <a href="https://twitter.com" className="text-gray-400 hover:text-white transition-colors">
                  Twitter
                </a>
                <a href="https://linkedin.com" className="text-gray-400 hover:text-white transition-colors">
                  LinkedIn
                </a>
                <a href="https://discord.com" className="text-gray-400 hover:text-white transition-colors">
                  Discord
                </a>
              </div>
            </div>

            <div className="card gradient-border">
              <h3 className="font-bold mb-2">Office Hours</h3>
              <p className="text-gray-400">Monday - Friday</p>
              <p className="text-gray-400">9:00 AM - 6:00 PM PST</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
