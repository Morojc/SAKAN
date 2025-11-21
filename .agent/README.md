# SAKAN Documentation Index

Welcome to the SAKAN (MyResidency) documentation. This index provides a comprehensive guide to all documentation available in the `.agent` folder, helping engineers quickly find the information they need.

## 📋 Overview

SAKAN is a property/residence management SaaS platform built for syndics (property managers) to manage residential buildings, residents, fees, payments, expenses, incidents, announcements, and more.

## 📁 Documentation Structure

### System Documentation (`/System`)
Core system architecture and technical documentation.

- **[project_architecture.md](./System/project_architecture.md)** - Comprehensive project architecture including:
  - Project goals and domain
  - Technology stack
  - Project structure
  - Authentication flow
  - Payment integration
  - API architecture
  - Frontend architecture
  - Integration points
  - Environment configuration

- **[database_schema.md](./System/database_schema.md)** - Complete database documentation including:
  - Schema overview (`dbasakan`)
  - Table definitions and relationships
  - Enums and types
  - Row Level Security (RLS) policies
  - Indexes and performance considerations
  - Migration strategy

### Standard Operating Procedures (`/SOP`)
Best practices and step-by-step guides for common development tasks.

- **[database_migrations.md](./SOP/database_migrations.md)** - How to create and run database migrations
- **[adding_new_pages.md](./SOP/adding_new_pages.md)** - Guide for adding new page routes
- **[supabase_integration.md](./SOP/supabase_integration.md)** - Best practices for Supabase integration
- **[server_actions.md](./SOP/server_actions.md)** - Patterns for creating server actions

### Tasks Documentation (`/Tasks`)
Feature requirements and implementation plans.

- Feature PRDs and implementation plans are stored here as they are developed
- Reference the `prompt/` folder in the root for detailed feature specifications

### Planning & Maintenance
Documentation planning and update tracking.

- **[PLAN.md](./PLAN.md)** - Comprehensive documentation update plan including:
  - Current documentation status
  - Identified gaps and missing documentation
  - Prioritized update tasks
  - Implementation timeline
  - Documentation standards and maintenance guidelines

## 🚀 Quick Start Guide

### For New Engineers

1. **Start here**: Read [project_architecture.md](./System/project_architecture.md) to understand the overall system
2. **Database**: Review [database_schema.md](./System/database_schema.md) to understand data models
3. **Development**: Check [SOP](./SOP/) folder for task-specific guides
4. **Features**: Review `prompt/` folder for feature requirements

### Common Tasks

- **Adding a new database table**: See [database_migrations.md](./SOP/database_migrations.md)
- **Creating a new page**: See [adding_new_pages.md](./SOP/adding_new_pages.md)
- **Working with Supabase**: See [supabase_integration.md](./SOP/supabase_integration.md)
- **Creating server actions**: See [server_actions.md](./SOP/server_actions.md)

## 🔗 Related Documentation

- **Root README.md**: Basic setup and environment configuration
- **SUPABASE_SETUP.md**: Supabase-specific setup instructions
- **.cursor/rules/**: Cursor IDE rules for development standards
- **prompt/**: Feature implementation guides and PRDs

## 📝 Documentation Maintenance

This documentation is maintained in the `.agent` folder and should be updated when:
- New features are added
- Architecture changes occur
- Database schema is modified
- New patterns or best practices are established

When updating documentation:
1. Update the relevant file in `.agent/System` or `.agent/SOP`
2. Update this README.md index if new files are added
3. Ensure no overlap between documentation files
4. Include "Related Docs" sections in new documentation

## 🏗️ Project Context

**Project Name**: SAKAN / MyResidency  
**Type**: Property/Residence Management SaaS  
**Primary Users**: Syndics (Property Managers), Residents, Guards  
**Tech Stack**: Next.js 15, React 19, TypeScript, Supabase, NextAuth, Stripe  
**Database**: PostgreSQL (Supabase) with `dbasakan` schema

---

*Last Updated: Initial documentation creation*

