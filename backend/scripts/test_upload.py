from django.test import Client
from posts.models import Group
from pathlib import Path

c = Client()
g,_ = Group.objects.get_or_create(name='Running Group', color='#2e6bff')
print('Using group id:', g.id)
with Path('testdata/dot.png').open('rb') as f:
    data = {
        'group_id': str(g.id),
        'user_name': 'Kendall',
        'caption': 'Test upload',
        'image': f,
    }
    resp = c.post('/api/posts/upload/', data)
    print('Status:', resp.status_code)
    try:
        print('JSON:', resp.json())
    except Exception as e:
        print('Response:', resp.content)
