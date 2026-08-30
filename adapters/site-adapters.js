// Handles site-specific edge cases beyond standard fightback patterns
const SiteAdapters = {
    configs: {
        'instagram.com': {
            name: 'Instagram'
            // Example: custom fightback interval or specific selector overrides
        },
        'example.com': {
            name: 'Example'
            // Placeholder for future sites that fight back aggressively
        }
    },
    
    getCurrentAdapter() {
        const hostname = window.location.hostname;
        for (const [domain, config] of Object.entries(this.configs)) {
            if (hostname.includes(domain)) return config;
        }
        return null;
    }
};

window.InstaAdapters = SiteAdapters;
