import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    'index',
    {
      type: 'category',
      label: 'Get started',
      collapsed: false,
      link: {
        type: 'generated-index',
        title: 'Get started with Impulse',
        description: 'Evaluate Impulse, install it, or run its packaged container.',
        slug: '/getting-started',
      },
      items: [
        'getting-started/quickstart',
        'getting-started/installation',
        'getting-started/docker',
      ],
    },
    {
      type: 'category',
      label: 'Configure traffic',
      link: {
        type: 'generated-index',
        title: 'Configure traffic',
        description: 'Define listeners, routes, backends, security, resilience, and operator endpoints.',
        slug: '/configure',
      },
      items: [
        'configuration/reference',
        'configuration/examples',
        'configuration/defaults',
        'configuration/routing-and-upstreams',
        'user-guide/load-balancing',
        'configuration/tls',
        'configuration/authentication-and-secrets',
        'configuration/resilience',
        'configuration/observability-and-control',
      ],
    },
    {
      type: 'category',
      label: 'Deploy and operate',
      link: {
        type: 'generated-index',
        title: 'Deploy and operate Impulse',
        description: 'Plan production rollout, capacity, observability, changes, and incident response.',
        slug: '/operations',
      },
      items: [
        'deployment/production',
        'operations/control-plane',
        'operations/reload-and-drain',
        'operations/secret-and-cert-rotation',
        'operations/distributed-quota',
        'operations/observability',
        'operations/sizing-and-capacity',
        'operations/runbook',
        'deployment/migration',
      ],
    },
    {
      type: 'category',
      label: 'Understand Impulse',
      link: {
        type: 'generated-index',
        title: 'Understand Impulse',
        description: 'Learn the request, runtime, transport, protocol, quota, and security models.',
        slug: '/architecture',
      },
      items: [
        'architecture/overview',
        'architecture/request-lifecycle',
        'architecture/runtime-generation',
        'architecture/transport-and-backend-lifecycle',
        'architecture/quota-policy-contract',
        'protocols/support',
        'concepts/security-model',
        'reference/terminology',
      ],
    },
    {
      type: 'category',
      label: 'Reference',
      link: {
        type: 'generated-index',
        title: 'Reference',
        description: 'Look up Control API behavior, metrics, product status, and future direction.',
        slug: '/reference',
      },
      items: [
        'reference/control-api-reference',
        'reference/metrics-reference',
        'reference/status-and-limitations',
        'roadmap',
      ],
    },
    'development/contributing',
  ],
};

export default sidebars;
