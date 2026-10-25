from django.db import migrations, models

DEFAULT_SITE_COPY = {
    "nav.home": "Home",
    "nav.discover": "Discover",
    "nav.writing": "Writing",
    "nav.favorites": "Favorites",
    "nav.projects": "Projects",
    "nav.resources": "Resources",
    "nav.collections": "Collections",
    "nav.about": "About",
    "nav.contact": "Contact",
    "nav.recommend": "Recommend",
    "home.hero.eyebrow": "A PERSONAL DIGITAL SPACE",
    "home.hero.intro": "A personal library of projects, thoughtful notes, useful links, and the digital things that make you curious.",
    "home.intro.heading": "Not just a portfolio.\nA place to wander.",
    "home.intro.body": "Some things deserve more than a bookmark. ALIB brings together the work being made, the ideas being explored, and the resources worth passing along — all in one thoughtful, searchable place.",
    "home.featured.eyebrow": "THE HIGHLIGHTS / 02",
    "home.featured.title": "Worth a closer look",
    "home.latest.eyebrow": "RECENTLY ADDED / 03",
    "home.latest.title": "Fresh from the archive",
    "home.pathways.eyebrow": "FIND YOUR WAY / 04",
    "home.pathways.title": "Different paths in.",
    "home.pathway.read.title": "Read & reflect",
    "home.pathway.read.body": "Essays, notes, and things learned along the way.",
    "home.pathway.save.title": "Save a little wonder",
    "home.pathway.save.body": "Websites and digital tools worth remembering.",
    "home.pathway.build.title": "See what's being built",
    "home.pathway.build.body": "Experiments, side projects, and work in progress.",
    "home.pathway.learn.title": "Keep learning",
    "home.pathway.learn.body": "Books, references, documents, and useful media.",
    "about.eyebrow": "ABOUT THIS SPACE",
    "about.title": "One place.\nMany curiosities.",
    "contact.eyebrow": "OPEN CHANNEL",
    "contact.title": "Say hello.",
    "contact.intro": "Questions, ideas, or a useful thing to add to the archive are all welcome.",
    "suggest.eyebrow": "COMMUNITY / RECOMMENDATIONS",
    "suggest.title": "Found something good?",
    "suggest.intro": "Recommend a website, video, book, project, or resource that deserves a spot in the archive.",
    "privacy.eyebrow": "PLAIN-LANGUAGE NOTICE",
    "privacy.title": "Privacy.",
    "footer.description": "A small home for a growing digital world.",
    "footer.newsletter_label": "Occasional notes from the archive"
}


def seed_site_copy_and_owner(apps, schema_editor):
    SiteSettings = apps.get_model('content', 'SiteSettings')
    CreatorProfile = apps.get_model('content', 'CreatorProfile')
    for row in SiteSettings.objects.all():
        merged = dict(DEFAULT_SITE_COPY)
        merged.update(row.site_copy or {})
        row.site_copy = merged
        if not row.owner_name:
            row.owner_name = 'Mukamyi Izere Arcange'
        if not row.copyright_text:
            row.copyright_text = '© {year} {owner_name}. All rights reserved.'
        row.save(update_fields=['site_copy', 'owner_name', 'copyright_text'])
    CreatorProfile.objects.filter(display_name__in=['', 'Your name']).update(display_name='Mukamyi Izere Arcange')


def reverse_seed(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [('content', '0004_contactmessage_archived')]
    operations = [
        migrations.AlterField(model_name='creatorprofile', name='display_name', field=models.CharField(default='Mukamyi Izere Arcange', max_length=120)),
        migrations.AddField(model_name='sitesettings', name='owner_name', field=models.CharField(default='Mukamyi Izere Arcange', max_length=160)),
        migrations.AddField(model_name='sitesettings', name='copyright_text', field=models.CharField(default='© {year} {owner_name}. All rights reserved.', max_length=240)),
        migrations.AddField(model_name='sitesettings', name='site_copy', field=models.JSONField(blank=True, default=dict)),
        migrations.RunPython(seed_site_copy_and_owner, reverse_seed),
    ]
