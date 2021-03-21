$(document).ready(function () {
    $('select').formSelect();
    $('.tooltipped').tooltip();
});

const msg = document.getElementById("msg");
const users_table = document.getElementById("users_table");
const system_users_table = document.getElementById("system_users_table");
const status_selinux = document.getElementById("status");

async function init() {
    let status = await cockpit.script("cat /etc/selinux/config | awk '$0 ~ /^SELINUX=/ {print $1}' | awk -F'[=]' '{print $2}'");
    let btn_selinux = document.createElement("button");
    let text = document.createElement("p");
    let str = status.toLowerCase() === "ativado" ? 
            'sed -i "s/=enforcing/=disabled/" /etc/selinux/config' : 
            'sed -i "s/=disabled/=enforcing/" /etc/selinux/config';

    enabled = status.toLowerCase().trim() === "enforcing" ? true : false;

    status_selinux.innerHTML = "";

    text.id = "status_selinux";
    text.textContent = "Status SELinux: ";

    btn_selinux.textContent = status.toLowerCase().trim() === "enforcing" ? "Ativado" : "Desativado";
    btn_selinux.classList.add("btn");
    btn_selinux.classList.add("tooltipped");
    btn_selinux.onclick = ()=>changeStatus(btn_selinux.textContent);

    status_selinux.appendChild(text);
    status_selinux.appendChild(btn_selinux);
}


function list_users() {
    cockpit.spawn(["/usr/share/cockpit/cockpit-selinux/scripts/list_samba_users"])
        .stream((data)=>func_output(data, users_table, "Remover", deluser))
        .catch(fail);
}

function list_system_users() {
    cockpit.spawn(["/usr/share/cockpit/cockpit-selinux/scripts/list_system_users"])
        .stream((data)=>func_output(data, system_users_table, "Adicionar", adduser))
        .catch(fail);
}

function adduser(item) {
    let isMachine = item.slice(-1) === "$"
    if(!isMachine) {
        let passwd = prompt(`Digite a senha do samba para ${item}:`);
        if (passwd === "" || !passwd) return;
        cockpit.spawn(["/usr/share/cockpit/cockpit-selinux/scripts/user_add", "-add", item, passwd])
            .done(()=> {
                toast(`Usuário "${item}" foi adicionado ao samba.`, "success");
                list_users();
            });
        
    } else {
        item = item.slice(0,-1);
        cockpit.spawn(["/usr/share/cockpit/cockpit-selinux/scripts/user_add", "-machine", item])
            .done(()=> {
                toast(`Usuário "${item}" foi adicionado ao samba.`, "success");
                list_users();
            });
    }
}

async function deluser(name) {
    await cockpit.spawn(["/usr/share/cockpit/cockpit-selinux/scripts/user_add", "-del", name]);
    users_table.innerHTML = "";
    toast(`Usuário "${name}" foi removido do samba.`, "success");
    list_users();
}

function success(message) {
    msg.style.color = "green";
    msg.innerHTML = message;
}

function fail() {
    msg.style.color = "red";
    msg.innerHTML = message;
}

function func_output(data, table, text, action) {
    let users = Array.from(data.split("\n")).filter((item) => item.length > 0);

    users_table.innerHTML = "";

    users.map((item) => {
        var tr = document.createElement('tr');   
        var td1 = document.createElement('td');
        var td2 = document.createElement('td');
        var btn = document.createElement('button');

        td1.textContent = item;
        btn.textContent = text;
        btn.classList.add("waves-effect");
        btn.classList.add("waves-light");
        btn.classList.add("btn");

        btn.onclick = ()=>action(item);
        td2.appendChild(btn);
        tr.appendChild(td1);
        tr.appendChild(td2);
        table.appendChild(tr);
    });
}

async function changeStatus(element = "") {
    let check = confirm(`Essa ação vai ${element.toLowerCase() === "ativado" ? "desativar" : "ativar"} o SELinux. Deseja continuar?`);

    if(check) {
        let str = element.toLowerCase() === "ativado" ? 
            'sed -i "s/=enforcing/=disabled/" /etc/selinux/config' : 
            'sed -i "s/=disabled/=enforcing/" /etc/selinux/config';

        await cockpit.script(str);
        toast(`SELinux ${element.toLowerCase() === "ativado" ? "desativado" : "ativado"}.`, "success");
        check = confirm(`Para que essa ação tenha algum efeito é necessário reiniciar. Deseja reiniciar?`);
        if(check) await cockpit.script("reboot");
        init();
    }
}

async function toast(message, type = 'info', duration = 2000) {
    await mdtoast(message, { type, duration });
}

//button.addEventListener("click", adduser);

init();
list_users();
list_system_users();

cockpit.transport.wait(function () { });
