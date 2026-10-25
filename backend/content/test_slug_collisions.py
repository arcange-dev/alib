from django.test import TestCase

from content.models import Category, Collection, Tag


class GeneratedSlugCollisionTests(TestCase):
    def test_generated_collection_slugs_are_unique_for_duplicate_titles(self):
        first = Collection.objects.create(title="Learning resources")
        second = Collection.objects.create(title="Learning resources")

        self.assertEqual(first.slug, "learning-resources")
        self.assertEqual(second.slug, "learning-resources-2")

    def test_generated_category_and_tag_slugs_handle_normalized_name_collisions(self):
        first_category = Category.objects.create(name="Web Dev")
        second_category = Category.objects.create(name="Web-Dev")
        first_tag = Tag.objects.create(name="Artificial Intelligence")
        second_tag = Tag.objects.create(name="Artificial-Intelligence")

        self.assertEqual(first_category.slug, "web-dev")
        self.assertEqual(second_category.slug, "web-dev-2")
        self.assertEqual(first_tag.slug, "artificial-intelligence")
        self.assertEqual(second_tag.slug, "artificial-intelligence-2")
