from django.core.management.base import BaseCommand
from posts.models import Post

class Command(BaseCommand):
    help = 'Deletes all posts from the database.'

    def handle(self, *args, **options):
        count, _ = Post.objects.all().delete()
        self.stdout.write(self.style.SUCCESS(f'Successfully deleted {count} posts.'))
