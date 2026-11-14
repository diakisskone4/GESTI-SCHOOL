/**
 * Dictionnaire de l'interface : une ligne par texte, « français ⇥ anglais ⇥ arabe ».
 * Le texte français doit être écrit exactement comme il s'affiche (espaces multiples ignorés).
 * Un texte absent du dictionnaire reste affiché en français.
 */
const LIGNES = String.raw`
(Année courante)	(Current year)	(السنة الحالية)
(facultatif)	(optional)	(اختياري)
+ Nouveau type	+ New type	+ نوع جديد
-- Choisir un enseignant --	-- Choose a teacher --	-- اختر معلمًا --
-- Choisir une classe --	-- Choose a class --	-- اختر قسمًا --
-- Choisir une salle --	-- Choose a room --	-- اختر قاعة --
-- Ne pas changer --	-- Do not change --	-- بدون تغيير --
-- Non affecté pour le moment --	-- Not assigned yet --	-- غير مُسند حاليًا --
-- Sans classe pour l'instant --	-- No class for now --	-- بدون قسم حاليًا --
-- Sélectionner l'année --	-- Select the year --	-- اختر السنة --
3 trimestres ont été automatiquement générés pour cette année !	3 terms have been automatically generated for this year!	تم إنشاء 3 فصول دراسية تلقائيًا لهذه السنة!
A valid number is required.	A valid number is required.	يجب إدخال رقم صحيح.
Absence	Absence	غياب
Absence marquée comme justifiée.	Absence marked as justified.	تم تسجيل الغياب كمبرر.
Absences	Absences	الغيابات
Absences & retards	Absences & lateness	الغيابات والتأخرات
Absences non justifiées	Unjustified absences	غيابات غير مبررة
Absents aujourd'hui	Absent today	الغائبون اليوم
Académie d'enseignement	Education academy	الأكاديمية التعليمية
Accueil	Home	الرئيسية
Accès indisponible	Access unavailable	الوصول غير متاح
Accédez à l'application depuis votre écran d'accueil ou votre bureau, en plein écran.	Open the app from your home screen or desktop, in full screen.	افتح التطبيق من شاشتك الرئيسية أو سطح المكتب بملء الشاشة.
Actif	Active	نشط
Actions	Actions	الإجراءات
Actualiser	Refresh	تحديث
Administrateur	Administrator	مدير النظام
Administrateur d'établissement	School administrator	مدير المؤسسة
Administration	Administration	الإدارة
Admis en classe supérieure	Promoted to the next class	ناجح إلى القسم الأعلى
Admis(e) — fin de cycle	Passed — end of cycle	ناجح(ة) — نهاية المرحلة
Adresse	Address	العنوان
Adresse de résidence	Home address	عنوان السكن
Adresse email	Email address	البريد الإلكتروني
Affectation à une classe	Class assignment	التعيين في قسم
Affecter	Assign	تعيين
Affecter à une classe	Assign to a class	تعيين في قسم
Affichage	Display	العرض
Affichage :	Display:	العرض:
Affiche du tableau d'honneur	Honour roll poster	ملصق لوحة الشرف
Afficher les élèves sans classe	Show students without a class	عرض التلاميذ بدون قسم
Ajouter	Add	إضافة
Ajouter un créneau	Add a slot	إضافة حصة
Ajouter un enseignant	Add a teacher	إضافة معلم
Ajouter un lien	Add a link	إضافة ربط
Ajouter un type	Add a type	إضافة نوع
Ajouter un utilisateur	Add a user	إضافة مستخدم
Ajouter un établissement	Add a school	إضافة مؤسسة
Ajouter une photo	Add a photo	إضافة صورة
Ajouter une période	Add a period	إضافة فترة
Anciennes notes	Previous grades	النقاط السابقة
Annonce publiée.	Announcement published.	تم نشر الإعلان.
Annonce supprimée.	Announcement deleted.	تم حذف الإعلان.
Annonces	Announcements	الإعلانات
Annuler	Cancel	إلغاء
Annuler le transfert	Cancel the transfer	إلغاء النقل
Annuler les modifications non enregistrées	Discard unsaved changes	إلغاء التعديلات غير المحفوظة
Annulez le transfert pour modifier	Cancel the transfer to edit	ألغِ النقل للتعديل
Annulée	Cancelled	ملغاة
Annulées	Cancelled	ملغاة
Année	Year	السنة
Année en cours	Current year	السنة الجارية
Année scolaire	School year	السنة الدراسية
Année scolaire :	School year:	السنة الدراسية:
Année scolaire enregistrée.	School year saved.	تم حفظ السنة الدراسية.
Année scolaire modifiée avec succès.	School year updated successfully.	تم تعديل السنة الدراسية بنجاح.
Année scolaire supprimée.	School year deleted.	تم حذف السنة الدراسية.
Années & Périodes	Years & Periods	السنوات والفترات
Années & Périodes Scolaires	School Years & Periods	السنوات والفترات الدراسية
Années scolaires	School years	السنوات الدراسية
Aperçu du document	Document preview	معاينة الوثيقة
Aperçu photo élève	Student photo preview	معاينة صورة التلميذ
Appliquer	Apply	تطبيق
Appréciation	Remark	الملاحظة
Archive complète	Full archive	أرشيف كامل
Archive complète créée : téléchargement en cours.	Full archive created: downloading.	تم إنشاء الأرشيف الكامل: جارٍ التنزيل.
Archive des élèves créée.	Student archive created.	تم إنشاء أرشيف التلاميذ.
Archive manuelle	Manual archive	أرشيف يدوي
Archives	Archives	الأرشيف
Arrêté d'ouverture	Opening order	قرار الفتح
Arrêté de création	Founding order	قرار الإنشاء
Associez les comptes parents à leurs enfants pour leur donner accès au suivi scolaire.	Link parent accounts to their children to give them access to school follow-up.	اربط حسابات الأولياء بأبنائهم لتمكينهم من متابعة الدراسة.
Attestation de fin de stage (stagiaire externe possible)	Internship completion certificate (external intern allowed)	شهادة نهاية التربص (يمكن لمتربص خارجي)
Attestation de passage	Promotion certificate	شهادة الانتقال
Attestation de réussite	Certificate of success	شهادة النجاح
Attestation de travail	Employment certificate	شهادة عمل
Au moins 8 caractères, pas uniquement des chiffres.	At least 8 characters, not only digits.	8 أحرف على الأقل، وليست أرقامًا فقط.
Aucun bulletin	No report card	لا يوجد كشف نقاط
Aucun compte parent trouvé. Créez-le d'abord dans « Utilisateurs » avec le rôle « Parent ».	No parent account found. Create it first in “Users” with the “Parent” role.	لم يتم العثور على حساب ولي أمر. أنشئه أولًا في «المستخدمون» بدور «ولي أمر».
Aucun cours	No lessons	لا توجد حصص
Aucun cours planifié	No lessons scheduled	لا توجد حصص مبرمجة
Aucun destinataire correspondant.	No matching recipient.	لا يوجد مستلم مطابق.
Aucun document	No document	لا توجد وثيقة
Aucun emploi du temps enregistré pour le moment.	No timetable saved yet.	لا يوجد جدول زمني مسجل حاليًا.
Aucun lauréat pour cette période	No honourees for this period	لا يوجد متفوقون في هذه الفترة
Aucun message pour l'instant	No messages yet	لا توجد رسائل حاليًا
Aucun paiement enregistré.	No payment recorded.	لا يوجد دفع مسجل.
Aucun profil élève n'est encore lié à ce compte. Contactez l'administration de votre établissement.	No student profile is linked to this account yet. Contact your school administration.	لا يوجد ملف تلميذ مرتبط بهذا الحساب بعد. اتصل بإدارة مؤسستك.
Aucun profil élève n'est encore lié à votre compte parent. Contactez l'administration de votre établissement.	No student profile is linked to your parent account yet. Contact your school administration.	لا يوجد ملف تلميذ مرتبط بحساب ولي الأمر بعد. اتصل بإدارة مؤسستك.
Aucun type d'évaluation n'est configuré	No assessment type is configured	لم يتم إعداد أي نوع من التقييمات
Aucun type de frais configuré. Cliquez sur « + Nouveau type » pour en créer un.	No fee type configured. Click “+ New type” to create one.	لم يتم إعداد أي نوع من الرسوم. اضغط «+ نوع جديد» لإنشاء واحد.
Aucun élève actif dans cette classe.	No active student in this class.	لا يوجد تلميذ نشط في هذا القسم.
Aucun élève enregistré pour le moment.	No student registered yet.	لا يوجد تلاميذ مسجلون حاليًا.
Aucun établissement courant :	No current school:	لا توجد مؤسسة حالية:
Aucun établissement sélectionné : la création de classes, niveaux, types de frais, etc. échouera tant que ce champ n'est pas renseigné.	No school selected: creating classes, levels, fee types, etc. will fail until this field is filled in.	لم يتم اختيار مؤسسة: سيفشل إنشاء الأقسام والمستويات وأنواع الرسوم وغيرها ما لم يُملأ هذا الحقل.
Aucune absence enregistrée.	No absence recorded.	لا يوجد غياب مسجل.
Aucune affectation active pour le moment.	No active assignment yet.	لا يوجد تعيين نشط حاليًا.
Aucune annonce publiée.	No announcement published.	لا توجد إعلانات منشورة.
Aucune année scolaire active :	No active school year:	لا توجد سنة دراسية نشطة:
Aucune année scolaire enregistrée	No school year saved	لا توجد سنة دراسية مسجلة
Aucune archive pour le moment.	No archive yet.	لا يوجد أرشيف حاليًا.
Aucune classe ouverte pour l'année en cours dans cet établissement.	No class open for the current year in this school.	لا يوجد قسم مفتوح للسنة الجارية في هذه المؤسسة.
Aucune classe.	No class.	لا توجد أقسام.
Aucune donnée de paie	No payroll data	لا توجد بيانات أجور
Aucune donnée pour le moment.	No data yet.	لا توجد بيانات حاليًا.
Aucune facture	No invoice	لا توجد فاتورة
Aucune facture en attente de paiement. 🎉	No invoice awaiting payment. 🎉	لا توجد فواتير في انتظار الدفع. 🎉
Aucune facture ou reçu pour le moment.	No invoice or receipt yet.	لا توجد فاتورة أو وصل حاليًا.
Aucune facture.	No invoice.	لا توجد فواتير.
Aucune inscription enregistrée.	No enrolment recorded.	لا يوجد تسجيل.
Aucune ligne dans cette catégorie.	No row in this category.	لا توجد أسطر في هذه الفئة.
Aucune note	No grades	لا توجد نقاط
Aucune notification	No notifications	لا توجد إشعارات
Aucune période	No period	لا توجد فترة
Aucune évaluation pour cette matière et cette période	No assessment for this subject and period	لا يوجد تقييم لهذه المادة وهذه الفترة
Automatique	Automatic	تلقائي
Autorisez les fenêtres pop-up pour imprimer l'emploi du temps.	Allow pop-up windows to print the timetable.	اسمح بالنوافذ المنبثقة لطباعة الجدول الزمني.
Autre	Other	أخرى
Avec votre matricule et votre date de naissance, votre compte est relié à votre dossier existant (notes, absences...).	With your student ID and date of birth, your account is linked to your existing record (grades, absences...).	برقم تسجيلك وتاريخ ميلادك، يُربط حسابك بملفك الحالي (النقاط، الغيابات...).
Avis de recouvrement	Payment reminder	إشعار تحصيل
Basculer maintenant vers ce nouvel établissement pour le configurer ?	Switch to this new school now to set it up?	الانتقال الآن إلى هذه المؤسسة الجديدة لإعدادها؟
Basculer vers cet établissement : toutes les pages afficheront ses données	Switch to this school: all pages will show its data	الانتقال إلى هذه المؤسسة: ستعرض كل الصفحات بياناتها
Besoins spéciaux / Allergies (optionnel)	Special needs / Allergies (optional)	احتياجات خاصة / حساسية (اختياري)
Billet d'entrée	Entry slip	ورقة الدخول
Boursiers	Scholarship holders	الممنوحون
Bulletin de paie généré.	Payslip generated.	تم إنشاء كشف الراتب.
Bulletins	Report cards	كشوف النقاط
Bulletins de la classe	Class report cards	كشوف نقاط القسم
Cachet de l'établissement	School stamp	ختم المؤسسة
CAP (optionnel)	CAP (optional)	مركز التنشيط التربوي (اختياري)
Carnet de notes	Grade book	دفتر النقاط
Carte	Card	البطاقة
Carte bancaire	Bank card	بطاقة بنكية
Carte scolaire	School ID card	البطاقة المدرسية
CARTE SCOLAIRE	SCHOOL ID CARD	البطاقة المدرسية
Carte scolaire générée et téléchargée.	School ID card generated and downloaded.	تم إنشاء البطاقة المدرسية وتنزيلها.
Carte scolaire générée.	School ID card generated.	تم إنشاء البطاقة المدرسية.
Cartes générées pour la classe.	Cards generated for the class.	تم إنشاء بطاقات القسم.
Cartes scolaires	School ID cards	البطاقات المدرسية
Cartes Scolaires	School ID Cards	البطاقات المدرسية
Cartes scolaires sécurisées avec QR Code	Secure school ID cards with QR code	بطاقات مدرسية مؤمنة برمز QR
CDD (Contrat à durée déterminée)	Fixed-term contract	عقد محدد المدة
CDI (Contrat à durée indéterminée)	Permanent contract	عقد غير محدد المدة
Ce compte doit être créé par un administrateur connecté.	This account must be created by a logged-in administrator.	يجب أن ينشئ هذا الحساب مدير متصل.
Centre d'Animation Pédagogique (primaire/collège)	Teaching support centre (primary/middle school)	مركز التنشيط التربوي (ابتدائي/إعدادي)
Certificat de fin de contrat	End-of-contract certificate	شهادة نهاية العقد
Certificat de fréquentation	Attendance certificate	شهادة الحضور
Certificat de scolarité	School enrolment certificate	شهادة مدرسية
Certificat de travail	Work certificate	شهادة عمل
Certificats, convocations, fiches et attestations — élèves et personnel	Certificates, notices, forms and attestations — students and staff	شهادات واستدعاءات واستمارات وإفادات — التلاميذ والموظفون
Cet élève n'a pas d'inscription active.	This student has no active enrolment.	هذا التلميذ ليس لديه تسجيل نشط.
Changement de classe	Class change	تغيير القسم
Changer d'établissement	Change school	تغيير المؤسسة
Changer de classe	Change class	تغيير القسم
Changer de destinataire	Change recipient	تغيير المستلم
Changer de fichier	Change file	تغيير الملف
Changer l'ordre des colonnes	Change column order	تغيير ترتيب الأعمدة
Changer la photo	Change photo	تغيير الصورة
Changer le mot de passe	Change password	تغيير كلمة المرور
Chaque carte scolaire générée intègre les données de l'élève, son matricule unique, sa photo, la signature de l'établissement et un QR Code infalsifiable pour contrôle rapide.	Each school ID card includes the student's details, unique ID, photo, the school's signature and a tamper-proof QR code for quick checks.	تتضمن كل بطاقة مدرسية بيانات التلميذ ورقمه الفريد وصورته وتوقيع المؤسسة ورمز QR غير قابل للتزوير للتحقق السريع.
Chargement des destinataires...	Loading recipients...	جارٍ تحميل المستلمين...
Chargement...	Loading...	جارٍ التحميل...
Choisir un établissement	Choose a school	اختر مؤسسة
Choisir une image	Choose an image	اختر صورة
Choisir…	Choose…	اختر…
Choisissez d'abord l'établissement	Choose the school first	اختر المؤسسة أولًا
Choisissez un fichier Excel (.xlsx), CSV ou PDF.	Choose an Excel (.xlsx), CSV or PDF file.	اختر ملف Excel (.xlsx) أو CSV أو PDF.
Choisissez une classe et une période pour voir les bulletins.	Choose a class and a period to see the report cards.	اختر قسمًا وفترة لعرض كشوف النقاط.
Choisissez une classe, une période et une matière pour ouvrir le carnet de notes.	Choose a class, a period and a subject to open the grade book.	اختر قسمًا وفترة ومادة لفتح دفتر النقاط.
Choisissez votre rôle dans Gesti-Scolaire	Choose your role in Gesti-Scolaire	اختر دورك في Gesti-Scolaire
Chèque	Cheque	شيك
Classe	Class	القسم
Classe : 6e A	Class: 6e A	القسم: 6e A
Classe actuelle	Current class	القسم الحالي
Classe actuelle :	Current class:	القسم الحالي:
Classe concernée	Class concerned	القسم المعني
Classe d'inscription	Enrolment class	قسم التسجيل
Classe de l'élève	Student's class	قسم التلميذ
Classe par défaut	Default class	القسم الافتراضي
Classe à choisir	Class to choose	يجب اختيار القسم
classe(s)	class(es)	قسم/أقسام
Classes	Classes	الأقسام
Classes & Niveaux	Classes & Levels	الأقسام والمستويات
Classes du fichier non reconnues : associez-les à une classe existante	Unrecognised classes in the file: match them to an existing class	أقسام غير معروفة في الملف: اربطها بقسم موجود
Classes en charge	Classes taught	الأقسام المسندة
Clôturer cette période	Close this period	إغلاق هذه الفترة
Clôturée	Closed	مغلقة
clôturée	closed	مغلقة
Code	Code	الرمز
Code (ex: SE, L, SES, TSE)	Code (e.g. SE, L, SES, TSE)	الرمز (مثال: SE، L، SES، TSE)
Code court (ex: MATH, FR, SVT)	Short code (e.g. MATH, FR, SVT)	رمز مختصر (مثال: MATH، FR، SVT)
Code court utilisé dans les matricules	Short code used in student IDs	رمز مختصر يُستعمل في أرقام التسجيل
Coefficient	Coefficient	المعامل
Coefficient par défaut	Default coefficient	المعامل الافتراضي
Colonnes lues : Nom, Prénom (ou « Nom et prénom »), Sexe, Date et lieu de naissance, Matricule, parents, téléphone… Rien n'est enregistré avant votre confirmation.	Columns read: Last name, First name (or “Full name”), Sex, Date and place of birth, Student ID, parents, phone… Nothing is saved before you confirm.	الأعمدة المقروءة: اللقب، الاسم (أو «الاسم الكامل»)، الجنس، تاريخ ومكان الميلاد، رقم التسجيل، الأولياء، الهاتف… لا يُحفظ شيء قبل تأكيدك.
Commencez par créer l'année scolaire en cours (ex: 2025-2026).	Start by creating the current school year (e.g. 2025-2026).	ابدأ بإنشاء السنة الدراسية الجارية (مثال: 2025-2026).
Comment la classe est reconnue	How the class is recognised	كيف يتم التعرف على القسم
Communication	Communication	التواصل
Comptabilité : recettes, recouvrement des frais scolaires et paie	Accounting: income, school fee collection and payroll	المحاسبة: المداخيل وتحصيل الرسوم المدرسية والأجور
Comptable	Accountant	المحاسب
Comptable / Caissier	Accountant / Cashier	محاسب / أمين صندوق
Compte actif (décocher pour bloquer la connexion)	Active account (uncheck to block login)	حساب نشط (ألغِ التحديد لمنع الدخول)
Compte parent	Parent account	حساب ولي الأمر
Comptes de connexion : administrateurs, enseignants, parents, élèves, comptables.	Login accounts: administrators, teachers, parents, students, accountants.	حسابات الدخول: المديرون، المعلمون، الأولياء، التلاميذ، المحاسبون.
Configurez le calendrier scolaire, les trimestres ou semestres utilisés pour les notes et bulletins.	Set up the school calendar and the terms or semesters used for grades and report cards.	اضبط التقويم المدرسي والفصول أو السداسيات المستعملة للنقاط والكشوف.
Confirmation	Confirmation	التأكيد
Confirmation du mot de passe	Confirm password	تأكيد كلمة المرور
Confirmer la suppression ?	Confirm deletion?	تأكيد الحذف؟
Connectez-vous à votre espace ERP	Log in to your ERP space	سجّل الدخول إلى فضاء ERP الخاص بك
Connecté en tant que	Logged in as	متصل باسم
Conseil	Council	المجلس
Conseil de classe	Class council	مجلس القسم
Consulter l'emploi du temps	View the timetable	عرض الجدول الزمني
Consulter le dossier scolaire	View the school record	عرض الملف الدراسي
Contact d'urgence (Parent / Tuteur)	Emergency contact (Parent / Guardian)	جهة الاتصال في حالة الطوارئ (ولي / وصي)
Contact principal	Main contact	جهة الاتصال الرئيسية
Contact principal de l'élève	Student's main contact	جهة الاتصال الرئيسية للتلميذ
Contenu	Content	المحتوى
Contenu du message	Message content	محتوى الرسالة
Converti automatiquement sur 20 pour la moyenne.	Automatically converted out of 20 for the average.	يُحوَّل تلقائيًا إلى 20 لحساب المعدل.
Convocation - Examen	Notice - Exam	استدعاء - امتحان
Convocation - Réunion	Notice - Meeting	استدعاء - اجتماع
Coordonnées	Contact details	بيانات الاتصال
Coordonnées & Santé	Contact & Health	بيانات الاتصال والصحة
Corbeille	Recycle bin	سلة المحذوفات
Courante	Current	الحالية
Créer	Create	إنشاء
Créer automatiquement 3 trimestres	Automatically create 3 terms	إنشاء 3 فصول تلقائيًا
Créer l'année	Create the year	إنشاء السنة
Créer l'année scolaire	Create the school year	إنشاء السنة الدراسية
Créer l'enseignant	Create the teacher	إنشاء المعلم
Créer les types par défaut	Create default types	إنشاء الأنواع الافتراضية
Créer un compte	Create an account	إنشاء حساب
Créer une année scolaire	Create a school year	إنشاء سنة دراسية
Créer votre compte	Create your account	أنشئ حسابك
Créez une interrogation, un devoir ou une composition pour commencer la saisie.	Create a quiz, homework or exam to start entering grades.	أنشئ استجوابًا أو فرضًا أو اختبارًا لبدء إدخال النقاط.
Créneau ajouté avec succès.	Slot added successfully.	تمت إضافة الحصة بنجاح.
Créneau d'emploi du temps modifié.	Timetable slot updated.	تم تعديل حصة الجدول الزمني.
Créneau supprimé du lundi au vendredi.	Slot deleted from Monday to Friday.	تم حذف الحصة من الاثنين إلى الجمعة.
Créneau supprimé.	Slot deleted.	تم حذف الحصة.
Créé avec succès.	Created successfully.	تم الإنشاء بنجاح.
Créé le	Created on	أُنشئ في
Créé par un administrateur	Created by an administrator	أنشأه مدير
Cycle	Cycle	المرحلة
Cycle d'enseignement	Education cycle	المرحلة التعليمية
Date	Date	التاريخ
Date d'échéance	Due date	تاريخ الاستحقاق
Date d'émission	Issue date	تاريخ الإصدار
Date de début	Start date	تاريخ البداية
Date de début de la permission	Leave start date	تاريخ بداية الإذن
Date de début du stage (optionnel)	Internship start date (optional)	تاريخ بداية التربص (اختياري)
Date de fin	End date	تاريخ النهاية
Date de fin (optionnel)	End date (optional)	تاريخ النهاية (اختياري)
Date de fin du stage (optionnel)	Internship end date (optional)	تاريخ نهاية التربص (اختياري)
Date de l'examen	Exam date	تاريخ الامتحان
Date de la réunion	Meeting date	تاريخ الاجتماع
Date de naissance	Date of birth	تاريخ الميلاد
Date de naissance à préciser	Date of birth to specify	يجب تحديد تاريخ الميلاد
Date limite de paiement	Payment deadline	آخر أجل للدفع
Demandez à l'administration de les configurer.	Ask the administration to set them up.	اطلب من الإدارة إعدادها.
Dernier diplôme	Latest diploma	آخر شهادة
Derniers encaissements	Latest payments	آخر المداخيل
Dernières absences et retards	Latest absences and lateness	آخر الغيابات والتأخرات
Destinataire	Recipient	المستلم
Devise / slogan	Motto / slogan	الشعار
Direction	Management	الإدارة
Document créé, génération du PDF...	Document created, generating the PDF...	تم إنشاء الوثيقة، جارٍ إنشاء PDF...
Document supprimé.	Document deleted.	تم حذف الوثيقة.
Documents	Documents	الوثائق
Documents administratifs	Administrative documents	الوثائق الإدارية
Documents employés	Staff documents	وثائق الموظفين
Documents reçus de l'administration	Documents received from the administration	وثائق واردة من الإدارة
Documents élèves	Student documents	وثائق التلاميذ
Données	Data	البيانات
Données élèves	Student data	بيانات التلاميذ
Dossier élève	Student record	ملف التلميذ
Doublon — ignoré	Duplicate — skipped	مكرر — تم تجاهله
Du lundi au vendredi	Monday to Friday	من الاثنين إلى الجمعة
Durée et motif (ex: 15 jours pour mariage)	Duration and reason (e.g. 15 days for a wedding)	المدة والسبب (مثال: 15 يومًا للزواج)
déc.	Dec.	ديسمبر
Décision	Decision	القرار
Décision du conseil de classe	Class council decision	قرار مجلس القسم
Décisions de fin d'année d'après la moyenne annuelle, puis passage automatique des élèves dans l'année suivante.	End-of-year decisions based on the annual average, then automatic promotion of students into the next year.	قرارات نهاية السنة حسب المعدل السنوي، ثم انتقال التلاميذ تلقائيًا إلى السنة الموالية.
Déconnexion	Log out	تسجيل الخروج
Définir comme année scolaire courante (active)	Set as current (active) school year	تعيين كسنة دراسية حالية (نشطة)
Définir comme période courante	Set as current period	تعيين كفترة حالية
Déjà connu : inscription	Already known: enrolment	معروف مسبقًا: تسجيل
Déjà inscrit — ignoré	Already enrolled — skipped	مسجل مسبقًا — تم تجاهله
Démarrez une conversation en cliquant sur "Nouveau message".	Start a conversation by clicking "New message".	ابدأ محادثة بالضغط على "رسالة جديدة".
Détecter la classe dans le fichier	Detect the class in the file	اكتشاف القسم من الملف
Effacé dans	Erased in	يُحذف خلال
Effectif	Headcount	العدد
Effectif maximum	Maximum headcount	العدد الأقصى
Effectifs par classe	Headcount per class	الأعداد حسب القسم
Email	Email	البريد الإلكتروني
Email de connexion (authentification)	Login email (authentication)	بريد الدخول (المصادقة)
Emploi du temps	Timetable	الجدول الزمني
Emploi du Temps	Timetable	الجدول الزمني
Emploi du temps par classe	Timetable by class	الجدول الزمني حسب القسم
Emploi du temps par enseignant	Timetable by teacher	الجدول الزمني حسب المعلم
Emploi du temps par salle	Timetable by room	الجدول الزمني حسب القاعة
Employé	Employee	الموظف
Employés payés	Employees paid	الموظفون الذين تقاضوا أجورهم
En cours	In progress	جارية
En cours de gestion	Currently managed	قيد الإدارة
Encaissements des 6 derniers mois	Payments over the last 6 months	المداخيل خلال الأشهر الستة الأخيرة
Encaisser	Collect payment	تحصيل
Encaisser & imprimer le reçu	Collect & print the receipt	تحصيل وطباعة الوصل
Encaisser un paiement	Collect a payment	تحصيل دفعة
Encaissé	Collected	المحصَّل
Encaissé aujourd'hui	Collected today	المحصَّل اليوم
Enfant :	Child:	الطفل:
Enregistrer	Save	حفظ
Enregistrer la première année	Save the first year	حفظ السنة الأولى
Enregistrer les modifications	Save changes	حفظ التعديلات
Enregistrer une année scolaire	Save a school year	حفظ سنة دراسية
Enregistré.	Saved.	تم الحفظ.
Enseignant	Teacher	المعلم
Enseignant (Professeur)	Teacher	المعلم (الأستاذ)
Enseignant créé et compte utilisateur généré.	Teacher created and user account generated.	تم إنشاء المعلم وحساب المستخدم الخاص به.
Enseignant modifié avec succès.	Teacher updated successfully.	تم تعديل المعلم بنجاح.
Enseignant non assigné	Teacher not assigned	لم يُعيَّن معلم
Enseignant supprimé.	Teacher deleted.	تم حذف المعلم.
Enseignants	Teachers	المعلمون
Envoyer le message	Send the message	إرسال الرسالة
Envoyé à :	Sent to:	أُرسلت إلى:
ERP Établissement	School ERP	نظام تسيير المؤسسة
Espèces	Cash	نقدًا
Ex : 2025-2026	e.g. 2025-2026	مثال: 2025-2026
Ex: 1er Trimestre	e.g. 1st Term	مثال: الفصل الأول
Ex: Algèbre & Géométrie, Littérature	e.g. Algebra & Geometry, Literature	مثال: الجبر والهندسة، الأدب
Ex: Demande de renseignement, Informations classe...	e.g. Information request, Class information...	مثال: طلب معلومات، معلومات القسم...
Ex: Master en Mathématiques, CAPES	e.g. Master's in Mathematics, teaching certificate	مثال: ماستر في الرياضيات، شهادة الكفاءة
Ex: Professeur certifié, Maître-assistant	e.g. Certified teacher, Assistant lecturer	مثال: أستاذ معتمد، أستاذ مساعد
Ex: Salle 01, Labo...	e.g. Room 01, Lab...	مثال: القاعة 01، المخبر...
Ex: Scolarité Trimestre 1	e.g. Tuition Term 1	مثال: رسوم الفصل الأول
Ex: Scolarité, Cantine, Transport...	e.g. Tuition, Canteen, Transport...	مثال: الدراسة، المطعم، النقل...
Ex: Travaux pratiques	e.g. Practical work	مثال: أعمال تطبيقية
Excel (.xlsx), CSV ou PDF — 10 Mo maximum	Excel (.xlsx), CSV or PDF — 10 MB maximum	Excel (.xlsx) أو CSV أو PDF — 10 ميغابايت كحد أقصى
Expéditeur	Sender	المرسل
Facturation & frais	Billing & fees	الفوترة والرسوم
Facturation & frais scolaires	Billing & school fees	الفوترة والرسوم المدرسية
Facture	Invoice	الفاتورة
Facture créée.	Invoice created.	تم إنشاء الفاتورة.
Factures	Invoices	الفواتير
Factures en retard	Overdue invoices	فواتير متأخرة
Factures par statut	Invoices by status	الفواتير حسب الحالة
Factures à recouvrer	Invoices to collect	فواتير للتحصيل
Fermer	Close	إغلاق
Fiche de licenciement	Dismissal form	استمارة الفصل
Fiche de permission	Leave form	استمارة الإذن
Fiche médicale	Medical form	البطاقة الطبية
Figure sur les certificats officiels	Shown on official certificates	يظهر في الشهادات الرسمية
Filles	Girls	البنات
Filles / Garçons	Girls / Boys	البنات / الأولاد
Filtrer par :	Filter by:	تصفية حسب:
Fin de cycle	End of cycle	نهاية المرحلة
Finances	Finance	المالية
Format officiel PVC CR80 (85,6 x 54 mm)	Official PVC CR80 format (85.6 x 54 mm)	الصيغة الرسمية PVC CR80 (85.6 × 54 مم)
Format portrait recommandé. Insérée sur la carte scolaire A6.	Portrait format recommended. Printed on the A6 school ID card.	يُنصح بالصيغة العمودية. تُدرج في البطاقة المدرسية A6.
Frais de scolarité, factures et paiements	Tuition fees, invoices and payments	الرسوم الدراسية والفواتير والمدفوعات
Frais scolaires	School fees	الرسوم المدرسية
Fusionner	Merge	دمج
Fusionné	Merged	مدمج
Félicitations aux meilleurs élèves !	Congratulations to the best students!	تهانينا لأفضل التلاميذ!
Féminin	Female	أنثى
févr.	Feb.	فبراير
Garçons	Boys	الأولاد
Gestion de la paie	Payroll management	تسيير الأجور
Gestion des inscriptions, profils scolaires et impression des cartes d'identité scolaire.	Enrolments, student profiles and printing of school ID cards.	تسيير التسجيلات والملفات الدراسية وطباعة البطاقات المدرسية.
Gestion du corps enseignant, matières dispensées, plannings et contrats.	Teaching staff, subjects taught, schedules and contracts.	تسيير هيئة التدريس والمواد المدرسة والجداول والعقود.
Glissez votre fichier ici ou cliquez pour le choisir	Drop your file here or click to choose it	اسحب ملفك هنا أو اضغط لاختياره
Grade / Diplôme	Grade / Diploma	الرتبة / الشهادة
Grade académique	Academic grade	الرتبة الأكاديمية
Grille hebdomadaire	Weekly grid	الشبكة الأسبوعية
Groupe sanguin	Blood group	فصيلة الدم
Groupé par type	Grouped by type	مجمّع حسب النوع
Général	General	عام
Générer	Generate	إنشاء
Générer 2 semestres	Generate 2 semesters	إنشاء سداسيين
Générer 3 trimestres	Generate 3 terms	إنشاء 3 فصول
Générer automatiquement les 3 trimestres (recommandé)	Automatically generate the 3 terms (recommended)	إنشاء الفصول الثلاثة تلقائيًا (مُستحسن)
Générer et télécharger la carte scolaire A6	Generate and download the A6 school ID card	إنشاء وتنزيل البطاقة المدرسية A6
Générer par classe	Generate by class	إنشاء حسب القسم
Générer toutes les cartes d'une classe	Generate all cards for a class	إنشاء كل بطاقات قسم
Générer un document	Generate a document	إنشاء وثيقة
Générer un document employé	Generate a staff document	إنشاء وثيقة موظف
Générer un document élève	Generate a student document	إنشاء وثيقة تلميذ
Générer une carte	Generate a card	إنشاء بطاقة
Générer une carte scolaire	Generate a school ID card	إنشاء بطاقة مدرسية
Générez et téléchargez les cartes scolaires officielles au format PVC (carte de crédit) avec QR code de vérification.	Generate and download official school ID cards in PVC (credit card) format with a verification QR code.	أنشئ ونزّل البطاقات المدرسية الرسمية بصيغة PVC (حجم البطاقة البنكية) مع رمز QR للتحقق.
Gérer les établissements	Manage schools	تسيير المؤسسات
Heure de début	Start time	ساعة البداية
Heure de fin	End time	ساعة النهاية
Horaire	Time	التوقيت
Hors connexion : les données affichées peuvent ne pas être à jour.	Offline: the data shown may not be up to date.	غير متصل: قد لا تكون البيانات المعروضة محدثة.
Identifiants invalides.	Invalid credentials.	بيانات الدخول غير صحيحة.
Identité de l'élève	Student identity	هوية التلميذ
Identité visuelle	Visual identity	الهوية البصرية
Identité, coordonnées, documents officiels et direction de vos établissements. « Gérer » bascule l'application vers l'établissement choisi.	Identity, contact details, official documents and management of your schools. “Manage” switches the app to the chosen school.	الهوية وبيانات الاتصال والوثائق الرسمية وإدارة مؤسساتك. «تسيير» ينقل التطبيق إلى المؤسسة المختارة.
Image apposée sur les bulletins et documents officiels	Image printed on report cards and official documents	صورة توضع على كشوف النقاط والوثائق الرسمية
Image de l'annonce	Announcement image	صورة الإعلان
Image précédente	Previous image	الصورة السابقة
Image suivante	Next image	الصورة التالية
Images	Images	الصور
Impayée	Unpaid	غير مدفوعة
Impayées	Unpaid	غير مدفوعة
Importer un autre fichier	Import another file	استيراد ملف آخر
Importer une liste	Import a list	استيراد قائمة
Importer une liste d'élèves	Import a student list	استيراد قائمة تلاميذ
Importer une liste d'élèves (Excel, CSV ou PDF)	Import a student list (Excel, CSV or PDF)	استيراد قائمة تلاميذ (Excel أو CSV أو PDF)
Impossible de créer le compte.	Unable to create the account.	تعذر إنشاء الحساب.
Imprimer / PDF	Print / PDF	طباعة / PDF
Inactif	Inactive	غير نشط
Inclure dans l'import	Include in the import	تضمين في الاستيراد
Informations générales	General information	معلومات عامة
Informations officielles	Official information	معلومات رسمية
Informations personnelles	Personal information	المعلومات الشخصية
Inscription	Enrolment	التسجيل
Inscription en classe	Class enrolment	التسجيل في القسم
Inscription libre	Open registration	تسجيل حر
Inscrire l'élève	Enrol the student	تسجيل التلميذ
Inscrire un nouvel élève	Enrol a new student	تسجيل تلميذ جديد
Inscrire un élève	Enrol a student	تسجيل تلميذ
Installer Gesti-Scolaire	Install Gesti-Scolaire	تثبيت Gesti-Scolaire
Installer l'application	Install the app	تثبيت التطبيق
Interrogations, devoirs et compositions : saisie des notes, moyennes et bulletins	Quizzes, homework and exams: grade entry, averages and report cards	الاستجوابات والفروض والاختبارات: إدخال النقاط والمعدلات والكشوف
Jeudi	Thursday	الخميس
Jour	Day	اليوم
Jour de la semaine	Day of the week	يوم الأسبوع
Justification	Justification	التبرير
Justifiée	Justified	مبرر
L'accès de votre établissement expire le	Your school's access expires on	ينتهي وصول مؤسستك في
L'accès de votre établissement à Gesti-Scolaire est suspendu. Contactez l'équipe Gesti-Scolaire.	Your school's access to Gesti-Scolaire is suspended. Contact the Gesti-Scolaire team.	تم تعليق وصول مؤسستك إلى Gesti-Scolaire. اتصل بفريق Gesti-Scolaire.
L'affiche (photos, noms, classes et moyennes) est publiée comme annonce, avec la liste des lauréats en texte.	The poster (photos, names, classes and averages) is published as an announcement, with the list of honourees as text.	يُنشر الملصق (الصور والأسماء والأقسام والمعدلات) كإعلان، مع قائمة المتفوقين نصًا.
L'année scolaire suivante sera créée automatiquement, avec ses classes.	The next school year will be created automatically, with its classes.	ستُنشأ السنة الدراسية الموالية تلقائيًا مع أقسامها.
l'année suivante	the next year	السنة الموالية
L'heure de début doit être antérieure à l'heure de fin.	The start time must be before the end time.	يجب أن تكون ساعة البداية قبل ساعة النهاية.
L'élève est inscrit pour l'année scolaire de la classe choisie. S'il est déjà inscrit cette année-là, il change simplement de classe.	The student is enrolled for the school year of the chosen class. If already enrolled that year, they simply change class.	يُسجَّل التلميذ في السنة الدراسية للقسم المختار. إذا كان مسجلًا تلك السنة، يتغير قسمه فقط.
La corbeille est vide.	The recycle bin is empty.	سلة المحذوفات فارغة.
La Directrice	The Headmistress	المديرة
La moyenne d'une matière est la moyenne de chaque type, pondérée par son coefficient. L'ordre définit l'ordre des colonnes du carnet.	A subject's average is the average of each type, weighted by its coefficient. The order sets the order of the grade book columns.	معدل المادة هو معدل كل نوع مرجحًا بمعامله. يحدد الترتيب ترتيب أعمدة الدفتر.
La Principale	The Principal	المديرة
La Proviseure	The Head teacher	مديرة الثانوية
Laisser vide pour générer automatiquement	Leave empty to generate automatically	اتركه فارغًا للإنشاء التلقائي
Laissez le mot de passe vide pour le conserver.	Leave the password empty to keep it.	اترك كلمة المرور فارغة للاحتفاظ بها.
lauréat(s) dans	honouree(s) in	متفوق(ون) في
Le 1er	The 1st	الأول
Le Directeur	The Headmaster	المدير
le nom de l'onglet Excel (un onglet par classe).	the Excel sheet name (one sheet per class).	اسم ورقة Excel (ورقة لكل قسم).
Le Principal	The Principal	المدير
Le Proviseur	The Head teacher	مدير الثانوية
Le seuil doit être compris entre 0 et 20.	The threshold must be between 0 and 20.	يجب أن تكون العتبة بين 0 و20.
Les deux mots de passe ne correspondent pas.	The two passwords do not match.	كلمتا المرور غير متطابقتين.
Les inscriptions créées dans l'année suivante par le transfert seront supprimées (sauf celles qui ont déjà des notes). Vous pourrez ensuite corriger les décisions et transférer à nouveau.	Enrolments created in the next year by the transfer will be deleted (except those that already have grades). You can then correct the decisions and transfer again.	ستُحذف التسجيلات التي أنشأها النقل في السنة الموالية (باستثناء التي لديها نقاط). يمكنك بعدها تصحيح القرارات وإعادة النقل.
Les premiers de chaque classe, d'après les moyennes des bulletins. Affiche à imprimer ou à publier.	The top students of each class, based on report card averages. Poster to print or publish.	أوائل كل قسم حسب معدلات الكشوف. ملصق للطباعة أو النشر.
Les types (Interrogation, Devoir, Composition...) et leur poids servent au calcul des moyennes.	Types (Quiz, Homework, Exam...) and their weights are used to compute averages.	تُستعمل الأنواع (استجواب، فرض، اختبار...) وأوزانها لحساب المعدلات.
Les éléments supprimés sont conservés 30 jours. Une restauration remet aussi en place tout ce qui avait été supprimé avec eux.	Deleted items are kept for 30 days. Restoring also brings back everything deleted with them.	تُحفظ العناصر المحذوفة 30 يومًا. الاسترجاع يعيد أيضًا كل ما حُذف معها.
Libellé	Label	التسمية
Libellé (optionnel)	Label (optional)	التسمية (اختياري)
Libellé de l'année scolaire	School year label	تسمية السنة الدراسية
Libellé de la période	Period label	تسمية الفترة
Lien parent-élève créé.	Parent-student link created.	تم إنشاء ربط ولي-تلميذ.
Lien parent-élève modifié.	Parent-student link updated.	تم تعديل ربط ولي-تلميذ.
Lien supprimé.	Link deleted.	تم حذف الربط.
lien(s)	link(s)	ربط
Liens parents-élèves	Parent-student links	روابط الأولياء والتلاميذ
Lier un parent à un élève	Link a parent to a student	ربط ولي بتلميذ
Lieu	Place	المكان
Lieu de consultation	Place of consultation	مكان الاستشارة
Lieu de naissance	Place of birth	مكان الميلاد
Lignes par page	Rows per page	أسطر في كل صفحة
Logo	Logo	الشعار
Lundi	Monday	الاثنين
Lundi → Vendredi	Monday → Friday	الاثنين ← الجمعة
Ma scolarité	My schooling	دراستي
Mali	Mali	مالي
Malienne	Malian	مالية
Mardi	Tuesday	الثلاثاء
Marquer justifiée	Mark as justified	تسجيل كمبرر
Marquer lu	Mark as read	تعليم كمقروء
Masculin	Male	ذكر
Masse salariale brute	Gross payroll	كتلة الأجور الإجمالية
Masse salariale du mois	Payroll for the month	كتلة أجور الشهر
Masse salariale nette	Net payroll	كتلة الأجور الصافية
Matière	Subject	المادة
Matières	Subjects	المواد
Matières enseignées	Subjects taught	المواد المدرسة
Matières enseignées (sélection multiple)	Subjects taught (multiple choice)	المواد المدرسة (اختيار متعدد)
Matricule	Student ID	رقم التسجيل
Matricule (si l'école vous en a déjà donné un)	Student ID (if the school already gave you one)	رقم التسجيل (إذا منحتك المدرسة رقمًا)
Membre	Member	عضو
Mention	Distinction	الملاحظة
Menu	Menu	القائمة
Mercredi	Wednesday	الأربعاء
Mes absences & retards	My absences & lateness	غياباتي وتأخراتي
Mes bulletins	My report cards	كشوف نقاطي
Mes classes	My classes	أقسامي
Mes notes par matière	My grades by subject	نقاطي حسب المادة
Message (facultatif)	Message (optional)	الرسالة (اختياري)
Message supprimé.	Message deleted.	تم حذف الرسالة.
Messagerie	Messaging	المراسلة
Messagerie Interne	Internal messaging	المراسلة الداخلية
Messages	Messages	الرسائل
Mixte (plusieurs cycles)	Mixed (several cycles)	مختلط (عدة مراحل)
Mobile Money	Mobile Money	الدفع عبر الهاتف
Mode de paiement	Payment method	طريقة الدفع
Modification	Edit	تعديل
Modifier	Edit	تعديل
Modifier l'année scolaire	Edit the school year	تعديل السنة الدراسية
Modifier l'enseignant	Edit the teacher	تعديل المعلم
Modifier l'utilisateur	Edit the user	تعديل المستخدم
Modifier l'évaluation	Edit the assessment	تعديل التقييم
Modifier la période	Edit the period	تعديل الفترة
Modifier le créneau de cours	Edit the lesson slot	تعديل الحصة
Modifier le lien parent-élève	Edit the parent-student link	تعديل ربط ولي-تلميذ
Modifier le profil	Edit the profile	تعديل الملف
Modifié avec succès.	Updated successfully.	تم التعديل بنجاح.
Mois	Month	الشهر
Mon profil	My profile	ملفي الشخصي
Mon profil et mot de passe	My profile and password	ملفي وكلمة المرور
Montant	Amount	المبلغ
Montant dû	Amount due	المبلغ المستحق
Montant dû (FCFA)	Amount due (FCFA)	المبلغ المستحق (فرنك إفريقي)
Montant payé	Amount paid	المبلغ المدفوع
Mot de passe	Password	كلمة المرور
Mot de passe actuel	Current password	كلمة المرور الحالية
Mot de passe changé.	Password changed.	تم تغيير كلمة المرور.
Motif	Reason	السبب
Motif d'entrée	Reason for entry	سبب الدخول
Motif de la consultation	Reason for consultation	سبب الاستشارة
Motif du licenciement	Reason for dismissal	سبب الفصل
Moy. annuelle	Annual avg.	المعدل السنوي
Moyenne	Average	المعدل
Moyenne de passage	Pass mark	معدل الانتقال
Moyenne générale	Overall average	المعدل العام
Mère	Mother	الأم
Nationalité	Nationality	الجنسية
Net à payer	Net pay	الصافي للدفع
Niveau	Level	المستوى
Niveau associé	Linked level	المستوى المرتبط
Niveaux	Levels	المستويات
Nom	Last name	اللقب
Nom & Prénom	Full name	الاسم الكامل
Nom (ex: 6e, Terminale, CP1)	Name (e.g. 6e, Terminale, CP1)	الاسم (مثال: 6e، Terminale، CP1)
Nom complet de la matière	Full subject name	الاسم الكامل للمادة
Nom de famille	Last name	اللقب
Nom de l'établissement	School name	اسم المؤسسة
Nom de la classe (ex: 6e A, Tle Sciences)	Class name (e.g. 6e A, Tle Sciences)	اسم القسم (مثال: 6e A)
Nom de la mère	Mother's name	اسم الأم
Nom de la série (ex: Sciences Exactes, Littérature)	Stream name (e.g. Exact Sciences, Literature)	اسم الشعبة (مثال: علوم دقيقة، آداب)
Nom du contact d'urgence	Emergency contact name	اسم جهة الاتصال في الطوارئ
Nom du directeur / proviseur	Headteacher's name	اسم المدير
Nom du père	Father's name	اسم الأب
Nom du/de la stagiaire (si non enregistré comme employé)	Intern's name (if not registered as an employee)	اسم المتربص (إن لم يكن مسجلًا كموظف)
Nom manquant	Last name missing	اللقب ناقص
Nombre de factures	Number of invoices	عدد الفواتير
Non	No	لا
Non affecté	Not assigned	غير مُسند
Non inscrit	Not enrolled	غير مسجل
Notes	Grades	النقاط
Notes & bulletins	Grades & report cards	النقاط والكشوف
Notes & Bulletins	Grades & Report cards	النقاط والكشوف
Notifications	Notifications	الإشعارات
Noté sur	Marked out of	منقطة على
Nouveau bulletin	New report card	كشف جديد
Nouveau bulletin de paie	New payslip	كشف راتب جديد
Nouveau message	New message	رسالة جديدة
Nouveau message interne	New internal message	رسالة داخلية جديدة
Nouveau mot de passe	New password	كلمة المرور الجديدة
Nouvel élève	New student	تلميذ جديد
Nouvelle année scolaire	New school year	سنة دراسية جديدة
Nouvelle classe	New class	قسم جديد
Nouvelle facture	New invoice	فاتورة جديدة
Nouvelle facture de frais	New fee invoice	فاتورة رسوم جديدة
Nouvelle évaluation	New assessment	تقييم جديد
Numéro	Number	الرقم
Numéro de téléphone	Phone number	رقم الهاتف
Né(e) le	Born on	تاريخ الميلاد
Objet / précisions	Subject / details	الموضوع / التفاصيل
Objet / précisions (optionnel)	Subject / details (optional)	الموضوع / التفاصيل (اختياري)
Objet du message	Message subject	موضوع الرسالة
Ordre	Order	الترتيب
Ordre hiérarchique d'affichage	Display order	ترتيب العرض
Organisation des cours, planning hebdomadaire, suivi des matières, salles et enseignants.	Lesson organisation, weekly schedule, tracking of subjects, rooms and teachers.	تنظيم الحصص والبرنامج الأسبوعي ومتابعة المواد والقاعات والمعلمين.
Oui	Yes	نعم
Page précédente	Previous page	الصفحة السابقة
Page suivante	Next page	الصفحة التالية
Paie	Payroll	الأجور
Paiement enregistré.	Payment recorded.	تم تسجيل الدفع.
Par date	By date	حسب التاريخ
Par mode de paiement	By payment method	حسب طريقة الدفع
par échéance	by due date	حسب الاستحقاق
Parcours scolaire	School history	المسار الدراسي
Parent	Parent	ولي الأمر
Parents	Parents	الأولياء
Partager	Share	مشاركة
Partielle	Partial	جزئية
Partielles	Partial	جزئية
Pas de moyenne	No average	لا يوجد معدل
Pas encore générée	Not generated yet	لم تُنشأ بعد
Passages de classe	Class promotions	الانتقال بين الأقسام
Pays	Country	البلد
Payé	Paid	مدفوع
Payée	Paid	مدفوعة
Payées	Paid	مدفوعة
Personnaliser	Customise	تخصيص
Photo d'identité	ID photo	صورة شمسية
Planifier	Schedule	برمجة
Planifier un cours dans l'emploi du temps	Schedule a lesson in the timetable	برمجة حصة في الجدول الزمني
Poste occupé (qualité)	Position held	المنصب المشغول
Pour créer des classes, veuillez d'abord enregistrer une année scolaire.	To create classes, please save a school year first.	لإنشاء الأقسام، يرجى حفظ سنة دراسية أولًا.
Pour des statistiques détaillées par classe (taux de réussite, moyenne, absences), rendez-vous sur la page « Notes & bulletins », sélectionnez une classe et une période.	For detailed statistics per class (pass rate, average, absences), go to the “Grades & report cards” page and select a class and a period.	للحصول على إحصائيات مفصلة لكل قسم (نسبة النجاح، المعدل، الغيابات)، انتقل إلى صفحة «النقاط والكشوف» واختر قسمًا وفترة.
Primaire	Primary	ابتدائي
Primaire (Fondamental 1er cycle)	Primary (Basic 1st cycle)	ابتدائي (أساسي الطور الأول)
Principal	Principal	المدير
Professeur principal	Form teacher	الأستاذ الرئيسي
Profil mis à jour.	Profile updated.	تم تحديث الملف.
Profil élève mis à jour avec succès.	Student profile updated successfully.	تم تحديث ملف التلميذ بنجاح.
Précisions (optionnel)	Details (optional)	تفاصيل (اختياري)
Précédent	Previous	السابق
Prénom	First name	الاسم
Prénom manquant	First name missing	الاسم ناقص
Préscolaire	Preschool	تحضيري
Préscolaire (Maternelle)	Preschool (Nursery)	تحضيري (روضة)
Public	Audience	الجمهور
Public cible	Target audience	الجمهور المستهدف
Publications de l'administration et des enseignants	Posts from the administration and teachers	منشورات الإدارة والمعلمين
Publier comme annonce	Publish as an announcement	نشر كإعلان
Publier le tableau d'honneur	Publish the honour roll	نشر لوحة الشرف
Publier une annonce	Publish an announcement	نشر إعلان
Père	Father	الأب
Période	Period	الفترة
Période clôturée (les notes ne peuvent plus être modifiées)	Period closed (grades can no longer be changed)	الفترة مغلقة (لا يمكن تعديل النقاط)
Période créée avec succès.	Period created successfully.	تم إنشاء الفترة بنجاح.
Période modifiée.	Period updated.	تم تعديل الفترة.
Période supprimée.	Period deleted.	تم حذف الفترة.
Périodes	Periods	الفترات
Périodes (Trimestres / Semestres)	Periods (Terms / Semesters)	الفترات (فصول / سداسيات)
Périodes générées avec succès !	Periods generated successfully!	تم إنشاء الفترات بنجاح!
Rang	Rank	الرتبة
Rechercher par nom ou email...	Search by name or email...	البحث بالاسم أو البريد...
Rechercher par nom ou matricule...	Search by name or student ID...	البحث بالاسم أو رقم التسجيل...
Rechercher par nom, email, téléphone...	Search by name, email, phone...	البحث بالاسم أو البريد أو الهاتف...
Rechercher par nom, prénom ou email...	Search by last name, first name or email...	البحث باللقب أو الاسم أو البريد...
Rechercher par nom, prénom ou matricule...	Search by last name, first name or student ID...	البحث باللقب أو الاسم أو رقم التسجيل...
Rechercher par nom, prénom, matricule, téléphone...	Search by name, student ID, phone...	البحث بالاسم أو رقم التسجيل أو الهاتف...
Rechercher par nom, sigle, ville...	Search by name, acronym, city...	البحث بالاسم أو الاختصار أو المدينة...
Rechercher par élève, matricule, n° de carte...	Search by student, student ID, card no...	البحث بالتلميذ أو رقم التسجيل أو رقم البطاقة...
Rechercher un parent, un élève, un matricule...	Search for a parent, a student, an ID...	البحث عن ولي أو تلميذ أو رقم تسجيل...
Rechercher un élève, une classe...	Search for a student, a class...	البحث عن تلميذ أو قسم...
Rechercher un élément supprimé...	Search for a deleted item...	البحث عن عنصر محذوف...
redoublant(s) réinscrit(s) dans la même classe	repeater(s) re-enrolled in the same class	معيد(ون) أُعيد تسجيلهم في نفس القسم
Redoublants	Repeaters	المعيدون
Redouble	Repeats	يعيد السنة
Regrouper en une seule case les créneaux identiques du lundi au vendredi (récréation, accueil, descente...)	Group identical slots from Monday to Friday into a single cell (break, arrival, dismissal...)	تجميع الحصص المتطابقة من الاثنين إلى الجمعة في خانة واحدة (الاستراحة، الاستقبال، الخروج...)
Relation	Relationship	صلة القرابة
Remplacer	Replace	استبدال
Restauration	Restore	الاسترجاع
Reste	Remaining	الباقي
Reste à recouvrer	Left to collect	المتبقي للتحصيل
Retard	Late	تأخر
Retards	Lateness	التأخرات
Retards aujourd'hui	Late today	المتأخرون اليوم
Retenues	Deductions	الاقتطاعات
Retirer	Remove	إزالة
Retour	Back	رجوع
Retour au tableau de bord	Back to the dashboard	العودة إلى لوحة القيادة
Retour à la connexion	Back to login	العودة إلى تسجيل الدخول
Reçu	Receipt	الوصل
Reçu de :	Received from:	مستلمة من:
Reçu le	Received on	استُلمت في
Reçus & factures	Receipts & invoices	الوصولات والفواتير
Récompenses	Rewards	المكافآت
Rédigez votre message ici...	Write your message here...	اكتب رسالتك هنا...
Référence	Reference	المرجع
réouverte	reopened	أُعيد فتحها
Réouvrir cette période	Reopen this period	إعادة فتح هذه الفترة
Répartition par sexe	Breakdown by sex	التوزيع حسب الجنس
Répondre	Reply	رد
S'il est déjà inscrit pour l'année de cette classe, il change simplement de classe.	If already enrolled for this class's year, the student simply changes class.	إذا كان مسجلًا في سنة هذا القسم، يتغير قسمه فقط.
Saisissez les notes puis calculez les moyennes pour établir le classement.	Enter the grades then compute the averages to establish the ranking.	أدخل النقاط ثم احسب المعدلات لوضع الترتيب.
Salaire brut	Gross salary	الراتب الإجمالي
Salaire de base (FCFA)	Base salary (FCFA)	الراتب الأساسي (فرنك إفريقي)
Salaires, primes, retenues et bulletins de paie	Salaries, bonuses, deductions and payslips	الرواتب والمنح والاقتطاعات وكشوف الرواتب
Salle	Room	القاعة
Salle :	Room:	القاعة:
Salle de classe	Classroom	قاعة الدرس
Salle de classe attribuée	Assigned classroom	القاعة المخصصة
Samedi	Saturday	السبت
Sanctions	Sanctions	العقوبات
Sans classe	No class	بدون قسم
Sans objet	Not applicable	لا ينطبق
Sans résultat	No result	بدون نتيجة
Sauvegardes ZIP des données de l'établissement, à télécharger et à conserver en lieu sûr.	ZIP backups of the school's data, to download and keep in a safe place.	نسخ احتياطية ZIP لبيانات المؤسسة، للتنزيل والحفظ في مكان آمن.
Scolarité	Schooling	الدراسة
Se déconnecter	Log out	تسجيل الخروج
Secondaire	Secondary	ثانوي
Secondaire 1er cycle (Collège)	Lower secondary (Middle school)	الثانوي الطور الأول (إعدادي)
Secondaire 2nd cycle (Lycée)	Upper secondary (High school)	الثانوي الطور الثاني (ثانوية)
Semestre	Semester	السداسي
Sexe	Sex	الجنس
Sexe à préciser	Sex to specify	يجب تحديد الجنس
Sigle	Acronym	الاختصار
Signaler	Report	تسجيل
Signaler une absence	Report an absence	تسجيل غياب
Signaler une absence / un retard	Report an absence / lateness	تسجيل غياب / تأخر
Signature du directeur	Headteacher's signature	توقيع المدير
Solde	Balance	الرصيد
Solde restant :	Remaining balance:	الرصيد المتبقي:
Spécialité	Speciality	التخصص
Stagiaire	Intern	متربص
Statistiques	Statistics	الإحصائيات
Statistiques & rapports	Statistics & reports	الإحصائيات والتقارير
Statut	Status	الحالة
Structure pédagogique : niveaux d'études, séries, classes et matières enseignées.	Teaching structure: levels, streams, classes and subjects taught.	الهيكل التربوي: المستويات والشعب والأقسام والمواد المدرسة.
Suivant	Next	التالي
Suivi de l'assiduité des élèves	Student attendance tracking	متابعة مواظبة التلاميذ
Suivi scolaire de vos enfants	Your children's school follow-up	المتابعة الدراسية لأبنائك
Super Admin	Super Admin	المدير العام
Super Administrateur	Super Administrator	المدير العام
Suppression	Deletion	الحذف
Supprimer	Delete	حذف
Supprimer ce cours de l'emploi du temps ?	Delete this lesson from the timetable?	حذف هذه الحصة من الجدول الزمني؟
Supprimer du lundi au vendredi	Delete from Monday to Friday	حذف من الاثنين إلى الجمعة
Supprimer définitivement	Delete permanently	حذف نهائي
Supprimer définitivement ce message ?	Permanently delete this message?	حذف هذه الرسالة نهائيًا؟
Supprimer l'évaluation	Delete the assessment	حذف التقييم
Supprimé	Deleted	محذوف
Supprimé.	Deleted.	تم الحذف.
Sur l'écran d'accueil	On the home screen	على الشاشة الرئيسية
Surveillant	Supervisor	المراقب
Surveillant général	Chief supervisor	المراقب العام
Sélectionner l'enseignant :	Select the teacher:	اختر المعلم:
Sélectionner la classe	Select the class	اختر القسم
Sélectionner la classe :	Select the class:	اختر القسم:
Sélectionner la salle :	Select the room:	اختر القاعة:
Sélectionner un employé...	Select an employee...	اختر موظفًا...
Sélectionner un parent...	Select a parent...	اختر وليًا...
Sélectionner un élève...	Select a student...	اختر تلميذًا...
Sélectionner un établissement...	Select a school...	اختر مؤسسة...
Sélectionner une classe...	Select a class...	اختر قسمًا...
Sélectionner une matière...	Select a subject...	اختر مادة...
Sélectionner votre classe...	Select your class...	اختر قسمك...
Sélectionner...	Select...	اختر...
Sélectionnez une classe et une période.	Select a class and a period.	اختر قسمًا وفترة.
Sélectionnez une classe.	Select a class.	اختر قسمًا.
Série	Stream	الشعبة
Série (optionnel pour le secondaire / lycée)	Stream (optional for secondary / high school)	الشعبة (اختياري للثانوي)
Séries (Lycée)	Streams (High school)	الشعب (ثانوية)
Tableau d'honneur	Honour roll	لوحة الشرف
Tableau d'honneur publié dans les annonces.	Honour roll published in the announcements.	تم نشر لوحة الشرف في الإعلانات.
Tableau de bord	Dashboard	لوحة القيادة
Tableau détaillé	Detailed table	جدول مفصل
Taux de recouvrement	Collection rate	نسبة التحصيل
Terminer	Finish	إنهاء
Titre	Title	العنوان
Total encaissé	Total collected	مجموع المحصَّل
Total facturé (net de remises)	Total invoiced (net of discounts)	مجموع الفوترة (بعد التخفيضات)
Total impayé	Total unpaid	مجموع غير المدفوع
Total élèves	Total students	مجموع التلاميذ
Touchez	Tap	المس
Tous	All	الكل
Tous les rôles	All roles	كل الأدوار
Tous les types	All types	كل الأنواع
Tout est réglé	All settled	كل شيء مسدد
Tout le monde	Everyone	الجميع
Tout marquer comme lu	Mark all as read	تعليم الكل كمقروء
Tout voir	See all	عرض الكل
Toutes	All	الكل
Toutes justifiées	All justified	كلها مبررة
Toutes les classes	All classes	كل الأقسام
Toutes les inscriptions actives de cette classe recevront une carte scolaire générée avec QR Code.	All active enrolments in this class will receive a school ID card with a QR code.	ستحصل كل التسجيلات النشطة في هذا القسم على بطاقة مدرسية برمز QR.
Toutes les relations	All relationships	كل صلات القرابة
Transférer	Transfer	نقل
Trimestre	Term	الفصل
Type	Type	النوع
Type d'établissement	School type	نوع المؤسسة
Type d'évaluation	Assessment type	نوع التقييم
Type de contrat	Contract type	نوع العقد
Type de document	Document type	نوع الوثيقة
Type de frais	Fee type	نوع الرسوم
Type de frais créé.	Fee type created.	تم إنشاء نوع الرسوم.
Types & pondérations	Types & weights	الأنواع والأوزان
Types créés : Interrogation ×1, Devoir ×1, Composition ×2.	Types created: Quiz ×1, Homework ×1, Exam ×2.	الأنواع المنشأة: استجواب ×1، فرض ×1، اختبار ×2.
Types d'évaluation & pondérations	Assessment types & weights	أنواع التقييم والأوزان
Types d'évaluation enregistrés.	Assessment types saved.	تم حفظ أنواع التقييم.
Télécharger en Excel	Download as Excel	تنزيل بصيغة Excel
Télécharger l'image	Download the image	تنزيل الصورة
Télécharger la facture (PDF A4)	Download the invoice (PDF A4)	تنزيل الفاتورة (PDF A4)
Télécharger la liste de tous les enseignants	Download the list of all teachers	تنزيل قائمة كل المعلمين
Télécharger le dernier reçu de paiement (PDF A5)	Download the latest payment receipt (PDF A5)	تنزيل آخر وصل دفع (PDF A5)
Télécharger le PDF	Download the PDF	تنزيل PDF
Télécharger toutes les classes (un onglet par classe)	Download all classes (one sheet per class)	تنزيل كل الأقسام (ورقة لكل قسم)
Téléphone	Phone	الهاتف
Téléphone d'urgence	Emergency phone	هاتف الطوارئ
Une erreur est survenue.	An error occurred.	حدث خطأ.
Utilisateur créé.	User created.	تم إنشاء المستخدم.
Utilisateur modifié.	User updated.	تم تعديل المستخدم.
Utilisateur supprimé.	User deleted.	تم حذف المستخدم.
utilisateur(s)	user(s)	مستخدم
Utilisateurs	Users	المستخدمون
Utilisée seulement pour les élèves dont le fichier n'indique pas la classe.	Only used for students whose file does not indicate the class.	تُستعمل فقط للتلاميذ الذين لا يحدد الملف قسمهم.
Vacataire	Temporary staff	متعاقد
Vacataire / Prestataire horaire	Temporary / hourly contractor	متعاقد / مقدم خدمة بالساعة
Vendredi	Friday	الجمعة
Veuillez d'abord créer une année scolaire avant de gérer ses périodes.	Please create a school year first before managing its periods.	يرجى إنشاء سنة دراسية أولًا قبل تسيير فتراتها.
Veuillez d'abord sélectionner une année scolaire.	Please select a school year first.	يرجى اختيار سنة دراسية أولًا.
Veuillez sélectionner un destinataire.	Please select a recipient.	يرجى اختيار مستلم.
Veuillez sélectionner un fichier image (JPG, PNG...).	Please select an image file (JPG, PNG...).	يرجى اختيار ملف صورة (JPG، PNG...).
Veuillez sélectionner un établissement.	Please select a school.	يرجى اختيار مؤسسة.
Veuillez sélectionner une classe.	Please select a class.	يرجى اختيار قسم.
Vider	Empty	إفراغ
Vider la corbeille	Empty the recycle bin	إفراغ سلة المحذوفات
Vie scolaire : assiduité et discipline de votre établissement	School life: attendance and discipline in your school	الحياة المدرسية: المواظبة والانضباط في مؤسستك
Ville	City	المدينة
Virement bancaire	Bank transfer	تحويل بنكي
Voir	View	عرض
Voir (A4)	View (A4)	عرض (A4)
Voir (A5)	View (A5)	عرض (A5)
Voir la facture	View the invoice	عرض الفاتورة
Voir le reçu	View the receipt	عرض الوصل
votre compte n'est rattaché à aucun établissement actif. Configurez-le avant de créer des niveaux, classes ou matières.	your account is not linked to any active school. Set it up before creating levels, classes or subjects.	حسابك غير مرتبط بأي مؤسسة نشطة. اضبطه قبل إنشاء المستويات أو الأقسام أو المواد.
Votre espace enseignant	Your teacher space	فضاء المعلم
Votre portail scolaire	Your school portal	بوابتك المدرسية
Votre scolarité	Your schooling	دراستك
Vue d'ensemble de l'établissement	School overview	نظرة عامة على المؤسسة
Vue d'ensemble de votre établissement	Overview of your school	نظرة عامة على مؤسستك
· les derniers ajoutés en premier	· most recent first	· الأحدث أولًا
À compléter	To complete	للإكمال
à l'instant	just now	الآن
Échanges sécurisés entre la direction, les enseignants, les élèves et les parents.	Secure exchanges between management, teachers, students and parents.	تبادل آمن بين الإدارة والمعلمين والتلاميذ والأولياء.
Échéance	Due date	الاستحقاق
Écrire un message	Write a message	كتابة رسالة
Élève	Student	التلميذ
Élève concerné	Student concerned	التلميذ المعني
Élève Exemple	Sample Student	تلميذ نموذجي
Élève inscrit (avec classe active)	Enrolled student (with active class)	تلميذ مسجل (بقسم نشط)
Élève inscrit avec succès.	Student enrolled successfully.	تم تسجيل التلميذ بنجاح.
Élève sans inscription active.	Student without active enrolment.	تلميذ بدون تسجيل نشط.
Élève supprimé.	Student deleted.	تم حذف التلميذ.
élève(s)	student(s)	تلميذ/تلاميذ
élève(s) en fin de cycle, sans réinscription	student(s) at the end of the cycle, not re-enrolled	تلميذ(ة) في نهاية المرحلة، دون إعادة تسجيل
élève(s) inscrit(s) dans la classe du niveau supérieur (ex. 6e A → 5e A)	student(s) enrolled in the next level's class (e.g. 6e A → 5e A)	تلميذ(ة) مسجل(ون) في قسم المستوى الأعلى (مثال: 6e A ← 5e A)
Élèves	Students	التلاميذ
Élèves inscrits	Enrolled students	التلاميذ المسجلون
Élèves par classe	Students per class	التلاميذ حسب القسم
Élèves récemment inscrits	Recently enrolled students	التلاميذ المسجلون حديثًا
Élément supprimé	Deleted item	عنصر محذوف
Élément supprimé définitivement.	Item permanently deleted.	تم حذف العنصر نهائيًا.
élément(s)	item(s)	عنصر/عناصر
Épingler en haut des annonces	Pin to the top of announcements	تثبيت في أعلى الإعلانات
Équipe Gesti-Scolaire	Gesti-Scolaire team	فريق Gesti-Scolaire
Établissement actif	Active school	المؤسسة النشطة
Établissement complet	Full school	المؤسسة كاملة
Établissement courant	Current school	المؤسسة الحالية
Établissement courant mis à jour.	Current school updated.	تم تحديث المؤسسة الحالية.
Établissement créé. Utilisez « Gérer » pour basculer vers lui.	School created. Use “Manage” to switch to it.	تم إنشاء المؤسسة. استعمل «تسيير» للانتقال إليها.
Établissement d'origine et spécialité (ex: Faculté des Langues (FLSL) - Anglais)	Institution of origin and speciality (e.g. Faculty of Languages - English)	مؤسسة التكوين والتخصص (مثال: كلية اللغات - الإنجليزية)
Établissement modifié.	School updated.	تم تعديل المؤسسة.
établissement(s)	school(s)	مؤسسة/مؤسسات
Établissements	Schools	المؤسسات
Évaluation créée : vous pouvez saisir les notes.	Assessment created: you can enter grades.	تم إنشاء التقييم: يمكنك إدخال النقاط.
Évaluation modifiée.	Assessment updated.	تم تعديل التقييم.
Évaluation supprimée.	Assessment deleted.	تم حذف التقييم.
— corrigez les notes en rouge avant d'enregistrer.	— correct the grades in red before saving.	— صحح النقاط باللون الأحمر قبل الحفظ.
— en cours	— current	— الجارية
— les anciennes notes saisies sans évaluation comptent comme un groupe de poids 1.	— older grades entered without an assessment count as one group with weight 1.	— النقاط القديمة المدخلة دون تقييم تُحتسب كمجموعة بوزن 1.
Langue	Language	اللغة
Français	French	الفرنسية
Anglais	English	الإنجليزية
Arabe	Arabic	العربية
Choisir la langue de l'application	Choose the app language	اختر لغة التطبيق
Bonjour,	Hello,	مرحبًا،
Mon profil	My profile	ملفي الشخصي
Administratif	Administrative	إداري
Élèves inscrits	Enrolled students	التلاميذ المسجلون
. Contactez l'équipe Gesti-Scolaire pour le prolonger.	. Contact the Gesti-Scolaire team to extend it.	. اتصل بفريق Gesti-Scolaire لتمديده.
. Ajoutez ensuite primes/retenues via le module dédié pour un calcul détaillé.	. Then add bonuses/deductions in the dedicated module for a detailed calculation.	. ثم أضف المنح/الاقتطاعات في الوحدة المخصصة لحساب مفصل.
affiché(s) sur	shown out of	معروض من أصل
Analyser le fichier	Analyse the file	تحليل الملف
Archiver les élèves	Archive students	أرشفة التلاميذ
Archiver tout l'établissement	Archive the whole school	أرشفة المؤسسة كاملة
autre(s) opération(s)	other operation(s)	عملية/عمليات أخرى
Calculer les moyennes	Compute averages	حساب المعدلات
Calculer moyennes & rangs	Compute averages & ranks	حساب المعدلات والرتب
Carte scolaire (A6)	School ID card (A6)	البطاقة المدرسية (A6)
Carte scolaire —	School ID card —	البطاقة المدرسية —
classe(s) —	class(es) —	قسم/أقسام —
Créer le compte	Create the account	إنشاء الحساب
créneau(x)	slot(s)	حصة/حصص
créneau(x) planifié(s)	slot(s) scheduled	حصة مبرمجة
dans Safari, puis	in Safari, then	في Safari، ثم
Elles apparaîtront automatiquement quand les bulletins du «	They will appear automatically when the report cards of «	ستظهر تلقائيًا عندما تكون كشوف «
Employé concerné	Employee concerned	الموظف المعني
encore été générée. Contactez l'administration de votre établissement.	been generated yet. Contact your school administration.	تُنشأ بعد. اتصل بإدارة مؤسستك.
est affecté(e) à la classe	is assigned to the class	عُيِّن(ت) في القسم
et	and	و
facture(s) dont l'échéance est dépassée	overdue invoice(s)	فاتورة/فواتير تجاوزت تاريخ الاستحقاق
facture(s) ·	invoice(s) ·	فاتورة/فواتير ·
Générer et télécharger	Generate and download	إنشاء وتنزيل
Générer les cartes	Generate the cards	إنشاء البطاقات
Gérer	Manage	تسيير
ignoré(s)	skipped	تم تجاهله
Image (PNG)	Image (PNG)	صورة (PNG)
Inscrire	Enrol	تسجيل
JPEG, PNG, WebP ou GIF,	JPEG, PNG, WebP or GIF,	JPEG أو PNG أو WebP أو GIF،
Ko · cliquez pour changer	KB · click to change	كيلوبايت · اضغط للتغيير
L'utilisateur devra changer ce mot de passe à sa prochaine connexion.	The user will have to change this password at their next login.	سيتعين على المستخدم تغيير كلمة المرور هذه عند دخوله القادم.
Les classes manquantes sont créées. L'année	Missing classes are created. The year	تُنشأ الأقسام الناقصة. السنة
ligne(s) à compléter ne seront pas importées	row(s) to complete will not be imported	سطر/أسطر للإكمال لن تُستورد
Mo maximum par image. Vous pouvez aussi glisser-déposer les images ici. Elles seront visibles par toutes les personnes qui reçoivent l'annonce.	MB maximum per image. You can also drag and drop images here. They will be visible to everyone who receives the announcement.	ميغابايت كحد أقصى لكل صورة. يمكنك أيضًا سحب الصور وإفلاتها هنا. ستكون مرئية لكل من يستلم الإعلان.
modification(s) non enregistrée(s)	unsaved change(s)	تعديل/تعديلات غير محفوظة
Montant dû :	Amount due:	المبلغ المستحق:
Moyenne/20	Average/20	المعدل/20
nouveau(x) dossier(s) créé(s) ·	new record(s) created ·	ملف/ملفات جديدة أُنشئت ·
N° Carte	Card no.	رقم البطاقة
Page	Page	الصفحة
Par	By	بواسطة
Pas encore de compte ?	No account yet?	ليس لديك حساب بعد؟
Pas encore de décisions pour	No decisions yet for	لا توجد قرارات بعد لـ
PDF à imprimer	PDF to print	PDF للطباعة
Publier	Publish	نشر
Période :	Period:	الفترة:
période(s)	period(s)	فترة/فترات
période(s). Les décisions se calculent automatiquement dès que les bulletins du «	period(s). Decisions are computed automatically as soon as the report cards of «	فترة/فترات. تُحسب القرارات تلقائيًا بمجرد أن تكون كشوف «
premier(s) affiché(s) sur	first shown out of	الأوائل المعروضون من أصل
Recalculer	Recompute	إعادة الحساب
Restaurer	Restore	استرجاع
reste consultable (notes, bulletins, tableau d'honneur).	remains viewable (grades, report cards, honour roll).	تبقى قابلة للاطلاع (النقاط، الكشوف، لوحة الشرف).
Rôle	Role	الدور
sans moyennes calculées pour cette période :	without averages computed for this period:	بدون معدلات محسوبة لهذه الفترة:
Se connecter	Log in	تسجيل الدخول
Toutes (	All (	الكل (
Transférer vers	Transfer to	نقل إلى
Tuteur/Tutrice	Guardian	الوصي
Télécharger	Download	تنزيل
Voir l'affiche	View the poster	عرض الملصق
· coef.	· coef.	· المعامل
· Né(e) le	· Born on	· تاريخ الميلاد
· Payé :	· Paid:	· المدفوع:
· Solde :	· Balance:	· الرصيد:
» sont calculés.	» are computed.	» محسوبة.
élève	student	تلميذ
élève(s) déjà connu(s) réinscrit(s) ·	already known student(s) re-enrolled ·	تلميذ معروف أُعيد تسجيله ·
élève(s) inscrit(s)	student(s) enrolled	تلميذ مسجل
élève(s) prêt(s) à inscrire	student(s) ready to enrol	تلميذ جاهز للتسجيل
élève(s) sans moyenne ne seront pas transférés.	student(s) without an average will not be transferred.	تلميذ بدون معدل لن يُنقل.
élève(s) ·	student(s) ·	تلميذ ·
élèves	students	تلاميذ
Émise le	Issued on	صدرت في
Établissement	School	المؤسسة
État	Status	الحالة
— Classe	— Class	— القسم
— matricule	— student ID	— رقم التسجيل
Nouveaux	New	جديد
Déjà connus	Already known	معروفون مسبقًا
Ignorés	Skipped	متجاهلون
Nouvel élève	New student	تلميذ جديد
Déjà connu : inscription	Already known: enrolment	معروف مسبقًا: تسجيل
Déjà inscrit — ignoré	Already enrolled — skipped	مسجل مسبقًا — تم تجاهله
Mon profil	My profile	ملفي الشخصي
Mon profil et mot de passe	My profile and password	ملفي وكلمة المرور
inscrit	enrolled	مسجل
inscrits	enrolled	مسجلون
élèves inscrits	enrolled students	تلاميذ مسجلون
élève inscrit	enrolled student	تلميذ مسجل
sur	of	من أصل
Affichage	Showing	العرض
une colonne « Classe » dans le tableau ;	a “Class” column in the table;	عمود «القسم» في الجدول؛
un titre au-dessus du tableau (« Classe : 6e A ») ;	a title above the table (“Class: 6e A”);	عنوان فوق الجدول («القسم: 6e A»)؛
`;

/** Textes dont une partie varie (nombres) : [expression, anglais, arabe] — $1, $2... reprennent les parties variables. */
export const MODELES = [
  [/^(\d[\d\s ]*) élèves? inscrits?$/, "$1 enrolled students", "$1 تلميذ مسجل"],
  [/^(\d[\d\s ]*) élèves?$/, "$1 students", "$1 تلميذ"],
  [/^(\d+) cours$/, "$1 lessons", "$1 حصص"],
  [/^(\d+) créneau\(x\)$/, "$1 slot(s)", "$1 حصة"],
  [/^(\d+) créneau\(x\) planifié\(s\)$/, "$1 slot(s) scheduled", "$1 حصة مبرمجة"],
  [/^dont (\d+) sans classe$/, "of which $1 without a class", "منهم $1 بدون قسم"],
  [/^Page (\d+) \/ (\d+)$/, "Page $1 / $2", "الصفحة $1 / $2"],
  [/^Inscrire (\d+) élèves?$/, "Enrol $1 student(s)", "تسجيل $1 تلميذ"],
  [/^Excel : (.+)$/, "Excel: $1", "Excel: $1"],
  [/^Classe (.+)$/, "Class $1", "القسم $1"],
  [/^Bonjour, (.+)$/, "Hello, $1", "مرحبًا، $1"],
  [/^(\d+) élève\(s\) inscrit\(s\) avec succès\.$/, "$1 student(s) enrolled successfully.", "تم تسجيل $1 تلميذ بنجاح."],
  [/^Ex ?: (.+)$/, "e.g. $1", "مثال: $1"],
];

export const DICTIONNAIRE = new Map(
  LIGNES.split("\n")
    .filter((ligne) => ligne.includes("\t"))
    .map((ligne) => {
      const [fr, en, ar] = ligne.split("\t");
      return [fr.replace(/\s+/g, " ").trim(), { en: en.trim(), ar: (ar || en).trim() }];
    })
);
