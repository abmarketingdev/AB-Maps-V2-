"""
Django management command to export learning data from SQLite to JSON format.
"""
import os
import sqlite3
import json
from django.core.management.base import BaseCommand
from django.core.serializers.json import DjangoJSONEncoder


class Command(BaseCommand):
    help = 'Export learning data from SQLite to JSON format'

    def add_arguments(self, parser):
        parser.add_argument(
            '--sqlite-path',
            type=str,
            help='Path to the SQLite database file',
            default='old_learning_db.sqlite3'
        )
        parser.add_argument(
            '--output-dir',
            type=str,
            help='Directory to save JSON files',
            default='learning_data_export'
        )

    def handle(self, *args, **options):
        sqlite_path = options['sqlite_path']
        output_dir = options['output_dir']

        if not os.path.exists(sqlite_path):
            self.stdout.write(
                self.style.ERROR(f'SQLite database not found: {sqlite_path}')
            )
            return

        # Create output directory
        os.makedirs(output_dir, exist_ok=True)

        self.stdout.write(
            self.style.SUCCESS(f'Starting export from: {sqlite_path}')
        )
        self.stdout.write(f'Output directory: {output_dir}')

        try:
            # Connect to SQLite database
            sqlite_conn = sqlite3.connect(sqlite_path)
            sqlite_conn.row_factory = sqlite3.Row
            sqlite_cursor = sqlite_conn.cursor()

            # Export data
            self.export_sections(sqlite_cursor, output_dir)
            self.export_lessons(sqlite_cursor, output_dir)
            self.export_quiz_questions(sqlite_cursor, output_dir)
            self.export_quiz_answers(sqlite_cursor, output_dir)
            self.export_user_progress(sqlite_cursor, output_dir)
            self.export_quiz_attempts(sqlite_cursor, output_dir)
            self.export_activity_logs(sqlite_cursor, output_dir)

            sqlite_conn.close()

            self.stdout.write(
                self.style.SUCCESS('Export completed successfully!')
            )
            self.stdout.write(f'Check the {output_dir} directory for JSON files')

        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'Export failed: {str(e)}')
            )
            raise

    def export_sections(self, cursor, output_dir):
        """Export sections to JSON."""
        self.stdout.write('Exporting sections...')
        
        cursor.execute("""
            SELECT id, title, slug, description, "order", is_active, 
                   duration_estimate_minutes, icon_emoji, icon_color, 
                   created_at, updated_at
            FROM learning_section
            ORDER BY "order"
        """)
        
        sections = [dict(row) for row in cursor.fetchall()]
        
        # Convert datetime objects to strings
        for section in sections:
            if section['created_at']:
                section['created_at'] = str(section['created_at'])
            if section['updated_at']:
                section['updated_at'] = str(section['updated_at'])
        
        output_file = os.path.join(output_dir, 'sections.json')
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(sections, f, indent=2, ensure_ascii=False, cls=DjangoJSONEncoder)
        
        self.stdout.write(f'  + Exported {len(sections)} sections to {output_file}')

    def export_lessons(self, cursor, output_dir):
        """Export lessons to JSON."""
        self.stdout.write('Exporting lessons...')
        
        cursor.execute("""
            SELECT id, section_id, title, slug, description, content, kind, 
                   content_url, "order", is_active, duration_estimate_minutes, 
                   pass_threshold_percent
            FROM learning_lesson
            ORDER BY section_id, "order"
        """)
        
        lessons = [dict(row) for row in cursor.fetchall()]
        
        output_file = os.path.join(output_dir, 'lessons.json')
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(lessons, f, indent=2, ensure_ascii=False, cls=DjangoJSONEncoder)
        
        self.stdout.write(f'  + Exported {len(lessons)} lessons to {output_file}')

    def export_quiz_questions(self, cursor, output_dir):
        """Export quiz questions to JSON."""
        self.stdout.write('Exporting quiz questions...')
        
        cursor.execute("""
            SELECT id, lesson_id, question_text, "order"
            FROM learning_quiz_question
            ORDER BY lesson_id, "order"
        """)
        
        questions = [dict(row) for row in cursor.fetchall()]
        
        output_file = os.path.join(output_dir, 'quiz_questions.json')
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(questions, f, indent=2, ensure_ascii=False, cls=DjangoJSONEncoder)
        
        self.stdout.write(f'  + Exported {len(questions)} quiz questions to {output_file}')

    def export_quiz_answers(self, cursor, output_dir):
        """Export quiz answers to JSON."""
        self.stdout.write('Exporting quiz answers...')
        
        cursor.execute("""
            SELECT id, question_id, answer_text, is_correct, "order"
            FROM learning_quiz_answer
            ORDER BY question_id, "order"
        """)
        
        answers = [dict(row) for row in cursor.fetchall()]
        
        output_file = os.path.join(output_dir, 'quiz_answers.json')
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(answers, f, indent=2, ensure_ascii=False, cls=DjangoJSONEncoder)
        
        self.stdout.write(f'  + Exported {len(answers)} quiz answers to {output_file}')

    def export_user_progress(self, cursor, output_dir):
        """Export user progress to JSON."""
        self.stdout.write('Exporting user progress...')
        
        cursor.execute("""
            SELECT user_id, lesson_id, status, time_spent_seconds, 
                   started_at, completed_at, last_activity_at
            FROM learning_user_lesson_progress
        """)
        
        progress = [dict(row) for row in cursor.fetchall()]
        
        # Convert datetime objects to strings
        for record in progress:
            if record['started_at']:
                record['started_at'] = str(record['started_at'])
            if record['completed_at']:
                record['completed_at'] = str(record['completed_at'])
            if record['last_activity_at']:
                record['last_activity_at'] = str(record['last_activity_at'])
        
        output_file = os.path.join(output_dir, 'user_progress.json')
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(progress, f, indent=2, ensure_ascii=False, cls=DjangoJSONEncoder)
        
        self.stdout.write(f'  + Exported {len(progress)} progress records to {output_file}')

    def export_quiz_attempts(self, cursor, output_dir):
        """Export quiz attempts to JSON."""
        self.stdout.write('Exporting quiz attempts...')
        
        cursor.execute("""
            SELECT user_id, lesson_id, score_percent, passed, 
                   started_at, submitted_at, duration_seconds
            FROM learning_quiz_attempt
        """)
        
        attempts = [dict(row) for row in cursor.fetchall()]
        
        # Convert datetime objects to strings
        for attempt in attempts:
            if attempt['started_at']:
                attempt['started_at'] = str(attempt['started_at'])
            if attempt['submitted_at']:
                attempt['submitted_at'] = str(attempt['submitted_at'])
        
        output_file = os.path.join(output_dir, 'quiz_attempts.json')
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(attempts, f, indent=2, ensure_ascii=False, cls=DjangoJSONEncoder)
        
        self.stdout.write(f'  + Exported {len(attempts)} quiz attempts to {output_file}')

    def export_activity_logs(self, cursor, output_dir):
        """Export activity logs to JSON."""
        self.stdout.write('Exporting activity logs...')
        
        cursor.execute("""
            SELECT user_id, section_id, lesson_id, event, created_at
            FROM learning_activity_log
        """)
        
        logs = [dict(row) for row in cursor.fetchall()]
        
        # Convert datetime objects to strings
        for log in logs:
            if log['created_at']:
                log['created_at'] = str(log['created_at'])
        
        output_file = os.path.join(output_dir, 'activity_logs.json')
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(logs, f, indent=2, ensure_ascii=False, cls=DjangoJSONEncoder)
        
        self.stdout.write(f'  + Exported {len(logs)} activity logs to {output_file}')
