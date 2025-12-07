from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('posts', '0007_group_is_public'),
    ]

    operations = [
        migrations.AddField(
            model_name='group',
            name='cover',
            field=models.ImageField(blank=True, null=True, upload_to='groups/covers/'),
        ),
    ]
