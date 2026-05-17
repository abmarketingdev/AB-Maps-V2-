"""
Email service for sending welcome emails and other notifications.
"""
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.conf import settings
from django.utils.html import strip_tags
import logging

logger = logging.getLogger(__name__)


class EmailService:
    """Service class for handling email operations."""
    
    @staticmethod
    def send_welcome_email(receiver_email, password, user_type, admin_name, admin_email, user_name):
        """
        Send a welcome email to a newly created user.
        
        Args:
            receiver_email (str): The email address of the new user
            password (str): The password for the new user
            user_type (str): The type of user (manager, employee, superuser)
            admin_name (str): The name of the admin who created the user
            admin_email (str): The email of the admin who created the user
            user_name (str): The username of the new user
            
        Returns:
            bool: True if email was sent successfully, False otherwise
        """
        try:
            # Prepare email context
            context = {
                'receiver_email': receiver_email,
                'password': password,
                'user_type': user_type,
                'admin_name': admin_name,
                'admin_email': admin_email,
                'user_name': user_name,
            }
            
            # Render HTML email template
            html_message = render_to_string('emails/welcome_email.html', context)
            
            # Create plain text version
            plain_message = strip_tags(html_message)
            
            # Email subject
            subject = "Velkommen til AB System"
            
            # Send email
            send_mail(
                subject=subject,
                message=plain_message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[receiver_email],
                html_message=html_message,
                fail_silently=False,
            )
            
            logger.info(f"Welcome email sent successfully to {receiver_email}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send welcome email to {receiver_email}: {str(e)}")
            return False
    
    @staticmethod
    def send_test_email(receiver_email):
        """
        Send a test email to verify email configuration.
        
        Args:
            receiver_email (str): The email address to send test email to
            
        Returns:
            bool: True if email was sent successfully, False otherwise
        """
        try:
            subject = "Test Email from AB System"
            message = "This is a test email to verify the email configuration is working correctly."
            
            send_mail(
                subject=subject,
                message=message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[receiver_email],
                fail_silently=False,
            )
            
            logger.info(f"Test email sent successfully to {receiver_email}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send test email to {receiver_email}: {str(e)}")
            return False

    @staticmethod
    def send_qc_sales_chief_digest(
        recipient_email,
        chief_display_name,
        contact_rows,
        *,
        sent_by_display,
    ):
        """
        Send an HTML digest of QC contacts to a sales chief.

        contact_rows: list of dicts with string values for template (see qc_sales_chief_contact_digest.html).
        """
        from django.utils import timezone as dj_tz

        try:
            now = dj_tz.now()
            context = {
                'chief_display_name': chief_display_name,
                'contact_rows': contact_rows,
                'contact_count': len(contact_rows),
                'sent_by_display': sent_by_display or '',
                'sent_at_display': now.strftime('%Y-%m-%d %H:%M UTC'),
            }
            html_message = render_to_string('emails/qc_sales_chief_contact_digest.html', context)
            plain_message = strip_tags(html_message)
            subject = f"[QC] Contact summary — {len(contact_rows)} contact(s) — {now.strftime('%Y-%m-%d')}"

            send_mail(
                subject=subject,
                message=plain_message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[recipient_email],
                html_message=html_message,
                fail_silently=False,
            )
            logger.info(
                "QC sales chief digest sent to %s (%d contacts)",
                recipient_email,
                len(contact_rows),
            )
            return True
        except Exception as e:
            logger.error(
                "Failed to send QC sales chief digest to %s: %s",
                recipient_email,
                str(e),
            )
            return False