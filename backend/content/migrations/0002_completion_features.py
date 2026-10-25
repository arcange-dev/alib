import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('content', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='mediaasset',
            name='alt_text',
            field=models.CharField(blank=True, max_length=300),
        ),
        migrations.CreateModel(
            name='ContentRevision',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('revision_number', models.PositiveIntegerField()),
                ('snapshot', models.JSONField(default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('editor', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
                ('item', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='revisions', to='content.contentitem')),
            ],
            options={'ordering': ['-revision_number']},
        ),
        migrations.AddConstraint(
            model_name='contentrevision',
            constraint=models.UniqueConstraint(fields=('item', 'revision_number'), name='unique_content_revision_number'),
        ),
        migrations.CreateModel(
            name='AnalyticsEvent',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('event_type', models.CharField(choices=[('page_view', 'Page view'), ('outbound_click', 'Outbound click'), ('search', 'Search')], db_index=True, max_length=24)),
                ('path', models.CharField(blank=True, max_length=512)),
                ('referrer', models.URLField(blank=True, max_length=1000)),
                ('visitor_hash', models.CharField(blank=True, db_index=True, max_length=64)),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('item', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='analytics_events', to='content.contentitem')),
            ],
            options={'ordering': ['-created_at']},
        ),
        migrations.AddIndex(
            model_name='analyticsevent',
            index=models.Index(fields=['event_type', 'created_at'], name='content_ana_event_t_6b18c1_idx'),
        ),
        migrations.AddIndex(
            model_name='analyticsevent',
            index=models.Index(fields=['path', 'created_at'], name='content_ana_path_72f48a_idx'),
        ),
        migrations.CreateModel(
            name='NewsletterSubscriber',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('email', models.EmailField(max_length=254, unique=True)),
                ('token_hash', models.CharField(blank=True, max_length=64, null=True, unique=True)),
                ('confirmed_at', models.DateTimeField(blank=True, null=True)),
                ('is_active', models.BooleanField(db_index=True, default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
        ),
        migrations.CreateModel(
            name='ContentReaction',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('reaction', models.CharField(choices=[('like', 'Like'), ('love', 'Love'), ('useful', 'Useful')], max_length=12)),
                ('visitor_hash', models.CharField(max_length=64)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('item', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='reactions', to='content.contentitem')),
            ],
        ),
        migrations.AddConstraint(
            model_name='contentreaction',
            constraint=models.UniqueConstraint(fields=('item', 'reaction', 'visitor_hash'), name='unique_item_visitor_reaction'),
        ),
        migrations.CreateModel(
            name='ContentComment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=120)),
                ('email', models.EmailField(max_length=254)),
                ('body', models.TextField(max_length=3000)),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('approved', 'Approved'), ('rejected', 'Rejected')], db_index=True, default='pending', max_length=12)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('moderated_at', models.DateTimeField(blank=True, null=True)),
                ('item', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='comments', to='content.contentitem')),
                ('moderated_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
            ],
            options={'ordering': ['-created_at']},
        ),
    ]
