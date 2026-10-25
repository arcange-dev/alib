import os

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = (
        "Create the first ALIB superuser from temporary ALIB_BOOTSTRAP_ADMIN_* "
        "environment variables. Safe to run at every start: it never changes "
        "an existing administrator's password."
    )

    def handle(self, *args, **options):
        username = os.environ.get("ALIB_BOOTSTRAP_ADMIN_USERNAME", "").strip()
        email = os.environ.get("ALIB_BOOTSTRAP_ADMIN_EMAIL", "").strip()
        password = os.environ.get("ALIB_BOOTSTRAP_ADMIN_PASSWORD", "")

        configured = [bool(username), bool(email), bool(password)]
        if not any(configured):
            self.stdout.write("Admin bootstrap is not configured; skipping.")
            return
        if not all(configured):
            raise CommandError(
                "Set ALIB_BOOTSTRAP_ADMIN_USERNAME, ALIB_BOOTSTRAP_ADMIN_EMAIL, "
                "and ALIB_BOOTSTRAP_ADMIN_PASSWORD together, or remove all three."
            )

        User = get_user_model()
        if User.objects.filter(is_active=True, is_superuser=True).exists():
            self.stdout.write(
                "An active superuser already exists; skipping bootstrap. "
                "Remove the temporary ALIB_BOOTSTRAP_ADMIN_* variables."
            )
            return

        if User.objects.filter(**{User.USERNAME_FIELD: username}).exists():
            raise CommandError(
                "The bootstrap username already belongs to a non-superuser account. "
                "Choose a different ALIB_BOOTSTRAP_ADMIN_USERNAME."
            )

        candidate = User(**{User.USERNAME_FIELD: username})
        if hasattr(candidate, "email"):
            candidate.email = email
        try:
            validate_password(password, user=candidate)
        except ValidationError as exc:
            raise CommandError("The bootstrap password does not meet Django's password policy.") from exc

        create_kwargs = {
            User.USERNAME_FIELD: username,
            "password": password,
        }
        if hasattr(User, "email"):
            create_kwargs["email"] = email
        User.objects.create_superuser(**create_kwargs)
        self.stdout.write(
            self.style.SUCCESS(
                "Created the initial ALIB superuser. Remove the temporary "
                "ALIB_BOOTSTRAP_ADMIN_* variables and redeploy now."
            )
        )
