# LiveWorld Map — Branding and Documentation Update

## Project identity

- **Project name:** LiveWorld Map
- **Maintainer and extension author:** [fcflo151](https://github.com/fcflo151)
- **Original foundation:** [OSIRIS](https://github.com/simplifaisoul/osiris) by [simplifaisoul](https://github.com/simplifaisoul)
- **License:** MIT, with both copyright holders named in [LICENSE](LICENSE)

LiveWorld Map is a further development of the original OSIRIS platform. The original creator and architecture are credited throughout the public README, documentation, license, and CasaOS metadata.

## Updated surfaces

- Application wordmarks, splash screen, documentation, social metadata, JSON-LD, PWA names, share copy, analytics title, and health response use **LiveWorld Map**.
- Canonical URL, Open Graph URLs, `robots.txt`, and `sitemap.xml` are generated from `NEXT_PUBLIC_SITE_URL` so Vercel deployments can use their actual domain.
- Docker Compose, CasaOS metadata, package name, Docker guide, and environment template use the LiveWorld Map identity. Existing `OSIRIS_*` environment variables are intentionally retained where the code still reads them, preserving existing deployments.
- Historical OSIRIS references that identify the original project remain only for attribution, legacy configuration, or internal compatibility identifiers.

## Vercel configuration

Vercel itself does not require an API key for Git-based deployment. Set `NEXT_PUBLIC_SITE_URL` to the production domain. Optional feed credentials are documented in [.env.example](.env.example); add only the variables for layers you choose to enable.
