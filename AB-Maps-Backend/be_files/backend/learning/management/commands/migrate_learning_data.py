"""
Django management command to migrate learning data from SQLite to PostgreSQL.
"""
import os
import sqlite3
from django.core.management.base import BaseCommand
from django.conf import settings
from django.db import connections
from django.contrib.auth import get_user_model
from learning.models import (
    Section, Lesson, QuizQuestion, QuizAnswer, UserLessonProgress,
    UserSectionProgress, QuizAttempt, ActivityLog
)

User = get_user_model()


class Command(BaseCommand):
    help = 'Migrate learning data from SQLite to PostgreSQL'

    def add_arguments(self, parser):
        parser.add_argument(
            '--sqlite-path',
            type=str,
            help='Path to the SQLite database file',
            default='old_learning_db.sqlite3'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be migrated without actually doing it'
        )
        parser.add_argument(
            '--skip-users',
            action='store_true',
            help='Skip user-related data migration'
        )

    def handle(self, *args, **options):
        sqlite_path = options['sqlite_path']
        dry_run = options['dry_run']
        skip_users = options['skip_users']

        if not os.path.exists(sqlite_path):
            self.stdout.write(
                self.style.ERROR(f'SQLite database not found: {sqlite_path}')
            )
            return

        self.stdout.write(
            self.style.SUCCESS(f'Starting migration from: {sqlite_path}')
        )

        if dry_run:
            self.stdout.write(
                self.style.WARNING('DRY RUN MODE - No data will be migrated')
            )

        try:
            # Connect to SQLite database
            sqlite_conn = sqlite3.connect(sqlite_path)
            sqlite_conn.row_factory = sqlite3.Row
            sqlite_cursor = sqlite_conn.cursor()

            # Migrate data
            self.migrate_sections(sqlite_cursor, dry_run)
            self.migrate_lessons(sqlite_cursor, dry_run)
            self.migrate_quiz_questions(sqlite_cursor, dry_run)
            self.migrate_quiz_answers(sqlite_cursor, dry_run)
            
            if not skip_users:
                self.migrate_user_progress(sqlite_cursor, dry_run)
                self.migrate_quiz_attempts(sqlite_cursor, dry_run)
                self.migrate_activity_logs(sqlite_cursor, dry_run)

            sqlite_conn.close()

            if not dry_run:
                self.stdout.write(
                    self.style.SUCCESS('Migration completed successfully!')
                )
            else:
                self.stdout.write(
                    self.style.SUCCESS('Dry run completed - check output above')
                )

        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'Migration failed: {str(e)}')
            )
            raise

    def migrate_sections(self, cursor, dry_run):
        """Migrate sections from SQLite to PostgreSQL."""
        self.stdout.write('Migrating sections...')
        
        cursor.execute("""
            SELECT id, title, slug, description, "order", is_active, 
                   duration_estimate_minutes, icon_emoji, icon_color, 
                   created_at, updated_at
            FROM learning_section
            ORDER BY "order"
        """)
        
        sections = cursor.fetchall()
        self.stdout.write(f'Found {len(sections)} sections to migrate')
        
        if dry_run:
            for section in sections:
                self.stdout.write(f'  - Section: {section["title"]} (Order: {section["order"]})')
            return

        for section_data in sections:
            # Check if section already exists
            if Section.objects.filter(slug=section_data['slug']).exists():
                self.stdout.write(f'  - Section "{section_data["title"]}" already exists, skipping')
                continue

            section = Section.objects.create(
                title=section_data['title'],
                slug=section_data['slug'],
                description=section_data['description'],
                order=section_data['order'],
                is_active=section_data['is_active'],
                duration_estimate_minutes=section_data['duration_estimate_minutes'],
                icon_emoji=section_data['icon_emoji'],
                icon_color=section_data['icon_color'],
                created_at=section_data['created_at'],
                updated_at=section_data['updated_at']
            )
            self.stdout.write(f'  + Migrated section: {section.title}')

    def migrate_lessons(self, cursor, dry_run):
        """Migrate lessons from SQLite to PostgreSQL."""
        self.stdout.write('Migrating lessons...')
        
        cursor.execute("""
            SELECT id, section_id, title, slug, description, content, kind, 
                   content_url, "order", is_active, duration_estimate_minutes, 
                   pass_threshold_percent
            FROM learning_lesson
            ORDER BY section_id, "order"
        """)
        
        lessons = cursor.fetchall()
        self.stdout.write(f'Found {len(lessons)} lessons to migrate')
        
        if dry_run:
            for lesson in lessons:
                self.stdout.write(f'  - Lesson: {lesson["title"]} (Section: {lesson["section_id"]})')
            return

        for lesson_data in lessons:
            # Check if lesson already exists
            if Lesson.objects.filter(slug=lesson_data['slug']).exists():
                self.stdout.write(f'  - Lesson "{lesson_data["title"]}" already exists, skipping')
                continue

            # Get the corresponding section
            try:
                section = Section.objects.get(id=lesson_data['section_id'])
            except Section.DoesNotExist:
                self.stdout.write(
                    self.style.WARNING(f'  ! Section {lesson_data["section_id"]} not found, skipping lesson')
                )
                continue

            lesson = Lesson.objects.create(
                section=section,
                title=lesson_data['title'],
                slug=lesson_data['slug'],
                description=lesson_data['description'],
                content=lesson_data['content'],
                kind=lesson_data['kind'],
                content_url=lesson_data['content_url'],
                order=lesson_data['order'],
                is_active=lesson_data['is_active'],
                duration_estimate_minutes=lesson_data['duration_estimate_minutes'],
                pass_threshold_percent=lesson_data['pass_threshold_percent']
            )
            self.stdout.write(f'  + Migrated lesson: {lesson.title}')

    def migrate_quiz_questions(self, cursor, dry_run):
        """Migrate quiz questions from SQLite to PostgreSQL."""
        self.stdout.write('Migrating quiz questions...')
        
        cursor.execute("""
            SELECT id, lesson_id, question_text, "order"
            FROM learning_quiz_question
            ORDER BY lesson_id, "order"
        """)
        
        questions = cursor.fetchall()
        self.stdout.write(f'Found {len(questions)} quiz questions to migrate')
        
        if dry_run:
            for question in questions:
                self.stdout.write(f'  - Question: {question["question_text"][:50]}...')
            return

        for question_data in questions:
            # Check if question already exists
            if QuizQuestion.objects.filter(
                lesson_id=question_data['lesson_id'],
                question_text=question_data['question_text']
            ).exists():
                self.stdout.write(f'  - Question already exists, skipping')
                continue

            # Get the corresponding lesson
            try:
                lesson = Lesson.objects.get(id=question_data['lesson_id'])
            except Lesson.DoesNotExist:
                self.stdout.write(
                    self.style.WARNING(f'  ! Lesson {question_data["lesson_id"]} not found, skipping question')
                )
                continue

            question = QuizQuestion.objects.create(
                lesson=lesson,
                question_text=question_data['question_text'],
                order=question_data['order']
            )
            self.stdout.write(f'  + Migrated question: {question.question_text[:50]}...')

    def migrate_quiz_answers(self, cursor, dry_run):
        """Migrate quiz answers from SQLite to PostgreSQL."""
        self.stdout.write('Migrating quiz answers...')
        
        cursor.execute("""
            SELECT id, question_id, answer_text, is_correct, "order"
            FROM learning_quiz_answer
            ORDER BY question_id, "order"
        """)
        
        answers = cursor.fetchall()
        self.stdout.write(f'Found {len(answers)} quiz answers to migrate')
        
        if dry_run:
            for answer in answers:
                self.stdout.write(f'  - Answer: {answer["answer_text"][:50]}... (Correct: {answer["is_correct"]})')
            return

        for answer_data in answers:
            # Check if answer already exists
            if QuizAnswer.objects.filter(
                question_id=answer_data['question_id'],
                answer_text=answer_data['answer_text']
            ).exists():
                self.stdout.write(f'  - Answer already exists, skipping')
                continue

            # Get the corresponding question
            try:
                question = QuizQuestion.objects.get(id=answer_data['question_id'])
            except QuizQuestion.DoesNotExist:
                self.stdout.write(
                    self.style.WARNING(f'  ! Question {answer_data["question_id"]} not found, skipping answer')
                )
                continue

            answer = QuizAnswer.objects.create(
                question=question,
                answer_text=answer_data['answer_text'],
                is_correct=answer_data['is_correct'],
                order=answer_data['order']
            )
            self.stdout.write(f'  + Migrated answer: {answer.answer_text[:50]}...')

    def migrate_user_progress(self, cursor, dry_run):
        """Migrate user progress from SQLite to PostgreSQL."""
        self.stdout.write('Migrating user progress...')
        
        # Get all users from current PostgreSQL database
        current_users = User.objects.all()
        user_map = {user.username: user.id for user in current_users}
        
        cursor.execute("""
            SELECT user_id, lesson_id, status, time_spent_seconds, 
                   started_at, completed_at, last_activity_at
            FROM learning_user_lesson_progress
        """)
        
        progress_records = cursor.fetchall()
        self.stdout.write(f'Found {len(progress_records)} progress records to migrate')
        
        if dry_run:
            for record in progress_records:
                self.stdout.write(f'  - Progress: User {record["user_id"]}, Lesson {record["lesson_id"]}')
            return

        migrated_count = 0
        for record in progress_records:
            # Try to find user by username or email
            try:
                # Get user from SQLite to find username/email
                cursor.execute("SELECT username, email FROM auth_user WHERE id = ?", (record['user_id'],))
                user_info = cursor.fetchone()
                
                if not user_info:
                    self.stdout.write(
                        self.style.WARNING(f'  ! User {record["user_id"]} not found in SQLite, skipping')
                    )
                    continue

                # Find user in current database
                current_user = None
                if user_info['username'] in user_map:
                    current_user = User.objects.get(id=user_map[user_info['username']])
                elif user_info['email']:
                    try:
                        current_user = User.objects.get(email=user_info['email'])
                    except User.DoesNotExist:
                        pass

                if not current_user:
                    self.stdout.write(
                        self.style.WARNING(f'  ! User {user_info["username"]} not found in current DB, skipping')
                    )
                    continue

                # Get the corresponding lesson
                try:
                    lesson = Lesson.objects.get(id=record['lesson_id'])
                except Lesson.DoesNotExist:
                    self.stdout.write(
                        self.style.WARNING(f'  ! Lesson {record["lesson_id"]} not found, skipping progress')
                    )
                    continue

                # Check if progress already exists
                if UserLessonProgress.objects.filter(
                    user=current_user,
                    lesson=lesson
                ).exists():
                    self.stdout.write(f'  - Progress already exists, skipping')
                    continue

                progress = UserLessonProgress.objects.create(
                    user=current_user,
                    lesson=lesson,
                    status=record['status'],
                    time_spent_seconds=record['time_spent_seconds'],
                    started_at=record['started_at'],
                    completed_at=record['completed_at'],
                    last_activity_at=record['last_activity_at']
                )
                migrated_count += 1

            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f'  ! Error migrating progress record: {str(e)}')
                )

        self.stdout.write(f'  + Migrated {migrated_count} progress records')

    def migrate_quiz_attempts(self, cursor, dry_run):
        """Migrate quiz attempts from SQLite to PostgreSQL."""
        self.stdout.write('Migrating quiz attempts...')
        
        cursor.execute("""
            SELECT user_id, lesson_id, score_percent, passed, 
                   started_at, submitted_at, duration_seconds
            FROM learning_quiz_attempt
        """)
        
        attempts = cursor.fetchall()
        self.stdout.write(f'Found {len(attempts)} quiz attempts to migrate')
        
        if dry_run:
            for attempt in attempts:
                self.stdout.write(f'  - Attempt: User {attempt["user_id"]}, Lesson {attempt["lesson_id"]}, Score: {attempt["score_percent"]}%')
            return

        migrated_count = 0
        for attempt_data in attempts:
            try:
                # Find user (same logic as progress migration)
                cursor.execute("SELECT username, email FROM auth_user WHERE id = ?", (attempt_data['user_id'],))
                user_info = cursor.fetchone()
                
                if not user_info:
                    continue

                current_user = None
                if user_info['username'] in user_map:
                    current_user = User.objects.get(id=user_map[user_info['username']])
                elif user_info['email']:
                    try:
                        current_user = User.objects.get(email=user_info['email'])
                    except User.DoesNotExist:
                        pass

                if not current_user:
                    continue

                # Get the corresponding lesson
                try:
                    lesson = Lesson.objects.get(id=attempt_data['lesson_id'])
                except Lesson.DoesNotExist:
                    continue

                # Check if attempt already exists
                if QuizAttempt.objects.filter(
                    user=current_user,
                    lesson=lesson,
                    submitted_at=attempt_data['submitted_at']
                ).exists():
                    continue

                attempt = QuizAttempt.objects.create(
                    user=current_user,
                    lesson=lesson,
                    score_percent=attempt_data['score_percent'],
                    passed=attempt_data['passed'],
                    started_at=attempt_data['started_at'],
                    submitted_at=attempt_data['submitted_at'],
                    duration_seconds=attempt_data['duration_seconds']
                )
                migrated_count += 1

            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f'  ! Error migrating quiz attempt: {str(e)}')
                )

        self.stdout.write(f'  + Migrated {migrated_count} quiz attempts')

    def migrate_activity_logs(self, cursor, dry_run):
        """Migrate activity logs from SQLite to PostgreSQL."""
        self.stdout.write('Migrating activity logs...')
        
        cursor.execute("""
            SELECT user_id, section_id, lesson_id, event, created_at
            FROM learning_activity_log
        """)
        
        logs = cursor.fetchall()
        self.stdout.write(f'Found {len(logs)} activity logs to migrate')
        
        if dry_run:
            for log in logs:
                self.stdout.write(f'  - Log: User {log["user_id"]}, Event: {log["event"]}')
            return

        migrated_count = 0
        for log_data in logs:
            try:
                # Find user (same logic as above)
                cursor.execute("SELECT username, email FROM auth_user WHERE id = ?", (log_data['user_id'],))
                user_info = cursor.fetchone()
                
                if not user_info:
                    continue

                current_user = None
                if user_info['username'] in user_map:
                    current_user = User.objects.get(id=user_map[user_info['username']])
                elif user_info['email']:
                    try:
                        current_user = User.objects.get(email=user_info['email'])
                    except User.DoesNotExist:
                        pass

                if not current_user:
                    continue

                # Get section and lesson if they exist
                section = None
                lesson = None
                
                if log_data['section_id']:
                    try:
                        section = Section.objects.get(id=log_data['section_id'])
                    except Section.DoesNotExist:
                        pass

                if log_data['lesson_id']:
                    try:
                        lesson = Lesson.objects.get(id=log_data['lesson_id'])
                    except Lesson.DoesNotExist:
                        pass

                # Check if log already exists
                if ActivityLog.objects.filter(
                    user=current_user,
                    event=log_data['event'],
                    created_at=log_data['created_at']
                ).exists():
                    continue

                log = ActivityLog.objects.create(
                    user=current_user,
                    section=section,
                    lesson=lesson,
                    event=log_data['event'],
                    created_at=log_data['created_at']
                )
                migrated_count += 1

            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f'  ! Error migrating activity log: {str(e)}')
                )

        self.stdout.write(f'  + Migrated {migrated_count} activity logs')
