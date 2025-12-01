from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('posts', '0002_groupinvite'),
    ]

    operations = [
        migrations.AddField(
            model_name='groupmembership',
            name='role',
            field=models.CharField(choices=[('member', 'Member'), ('moderator', 'Moderator')], default='member', max_length=16),
        ),
    ]

