from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('content', '0003_staff_two_factor'),
    ]

    operations = [
        migrations.AddField(
            model_name='contactmessage',
            name='archived',
            field=models.BooleanField(db_index=True, default=False),
        ),
    ]
