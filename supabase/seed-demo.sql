-- Run manually ONCE in SQL Editor, after creating three Auth accounts.
-- Replace the three example emails below with the accounts you created.
-- No passwords or service keys are stored here. Entire seed is transactional.
begin;
do $$
declare
 m uuid; w1 uuid; w2 uuid; o1 uuid:=gen_random_uuid(); o2 uuid:=gen_random_uuid();
 t1 uuid; t2 uuid; t3 uuid; t4 uuid; t5 uuid;
begin
 select id into m from auth.users where email='postanovshik@mail.ru';
 select id into w1 from auth.users where email='ispolnitel1@mail.ru';
 select id into w2 from auth.users where email='ispolnitel2@mail.ru';
 if m is null or w1 is null or w2 is null or m=w1 or m=w2 or w1=w2 then
  raise exception 'Создайте три разных Auth-аккаунта и замените email в seed-demo.sql';
 end if;
 insert into public.profiles(id,full_name,role) values
 (m,'Алексей Смирнов','manager'),(w1,'Иван Петров','worker'),(w2,'Сергей Волков','worker');
 insert into public.objects(id,name,address) values
 (o1,'ЖК «Северный парк»','Москва, ул. Дыбенко, 12'),
 (o2,'Бизнес-центр «Горизонт»','Москва, Ленинградский проспект, 74');
 perform set_config('request.jwt.claim.sub',m::text,true);
 insert into public.tasks(object_id,title,description,assignee_id,author_id) values(o1,'Проверить разметку перегородок','Сверить разметку второго этажа с рабочей документацией.',w1,m) returning id into t1;
 insert into public.tasks(object_id,title,description,assignee_id,author_id) values(o1,'Подготовить проёмы под двери','Проверить размеры и вертикальность проёмов.',w1,m) returning id into t2;
 insert into public.tasks(object_id,title,description,assignee_id,author_id) values(o2,'Проверить монтаж вентиляции','Проверить крепления и герметичность соединений.',w2,m) returning id into t3;
 insert into public.tasks(object_id,title,description,assignee_id,author_id) values(o2,'Принять стяжку пола','Контроль ровности покрытия первого этажа.',w2,m) returning id into t4;
 insert into public.tasks(object_id,title,description,assignee_id,author_id) values(o1,'Проверить оконные примыкания','Проверить герметизацию стыков.',w1,m) returning id into t5;
 perform set_config('request.jwt.claim.sub',w1::text,true);
 perform public.change_task_status(t2,'in_progress','Приступил к работе');
 perform public.change_task_status(t5,'in_progress',null);
 perform public.change_task_status(t5,'review','Готово к проверке');
 perform set_config('request.jwt.claim.sub',w2::text,true);
 perform public.change_task_status(t3,'in_progress',null);
 perform public.change_task_status(t3,'review','Монтаж проверен');
 perform public.change_task_status(t4,'in_progress',null);
 perform public.change_task_status(t4,'review',null);
 perform set_config('request.jwt.claim.sub',m::text,true);
 perform public.change_task_status(t4,'accepted','Работа принята');
 perform public.change_task_status(t5,'rework','Повторно загерметизировать левый стык');
end $$;
commit;
