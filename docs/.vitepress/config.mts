import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Nimble FoundryVTT',
  description: 'Documentation hub for the Nimble FoundryVTT system',

  // Set base path for GitHub Pages, update if using a custom domain
  base: '/FoundryVTT-Nimble/',

  head: [
    ['link', { rel: 'icon', type: 'image/x-icon', href: '/FoundryVTT-Nimble/favicon.ico' }],
  ],

  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Contributing', link: '/contributing' },
      {
        text: 'Guides',
        items: [
          { text: 'Code Style Guide', link: '/STYLE_GUIDE' },
          { text: 'Release Guide', link: '/RELEASE_GUIDE' },
        ],
      },
      { text: 'System', link: '/system/' },
      {
        text: 'Planning',
        items: [
          { text: 'Project Vision', link: '/planning/product-vision' },
          { text: 'Architecture', link: '/planning/architecture' },
          {
            text: 'UX Design',
            link: '/planning/ux-design-specification',
            items: [
              { text: 'Design Directions', link: '/planning/ux-design-directions' },
            ],
          },
          { text: 'Epics & Stories', link: '/planning/epics' },
        ],
      },
    ],

    sidebar: [
      {
        text: 'Getting Started',
        items: [
          { text: 'Introduction', link: '/' },
          { text: 'Contributing', link: '/contributing' },
        ],
      },
      {
        text: 'Guides',
        items: [
          { text: 'Code Style Guide', link: '/STYLE_GUIDE' },
          { text: 'Release Guide', link: '/RELEASE_GUIDE' },
        ],
      },
      {
        text: 'System',
        items: [
          { text: 'Overview', link: '/system/' },
        ],
      },
      {
        text: 'Planning',
        collapsed: true,
        items: [
          { text: 'Project Vision', link: '/planning/product-vision' },
          { text: 'Architecture', link: '/planning/architecture' },
          {
            text: 'UX Design',
            link: '/planning/ux-design-specification',
            items: [
              { text: 'Design Directions', link: '/planning/ux-design-directions' },
            ],
          },
          { text: 'Epics & Stories', link: '/planning/epics' },
        ],
      },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/Nimble-Co/FoundryVTT-Nimble' },
      { icon: 'discord', link: 'https://discord.gg/APTKATGeJW' },
    ],

    search: {
      provider: 'local',
    },

    editLink: {
      pattern: 'https://github.com/Nimble-Co/FoundryVTT-Nimble/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
    },

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2024-2025 Nimble Co.',
    },
  },
})
