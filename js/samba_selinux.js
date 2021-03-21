$(document).ready(function () {
    $('select').formSelect();
});

let select_permissions = document.getElementById("select_permissions");
let dados = [];
const box_submit = document.getElementById("box_submit");
const status_selinux = document.getElementById("status");
let enabled;

async function init() {
    let status = await cockpit.script("cat /etc/selinux/config | awk '$0 ~ /^SELINUX=/ {print $1}' | awk -F'[=]' '{print $2}'");
    let btn_selinux = document.createElement("button");
    let text = document.createElement("p");

    enabled = status.toLowerCase().trim() === "enforcing" ? true : false;

    status_selinux.innerHTML = "";

    text.id = "status_selinux";
    text.textContent = "Status SELinux: ";

    btn_selinux.textContent = status.toLowerCase().trim() === "enforcing" ? "Ativado" : "Desativado";
    btn_selinux.classList.add("btn");
    btn_selinux.onclick = ()=>changeStatus(btn_selinux.textContent);
    
    status_selinux.appendChild(text);
    status_selinux.appendChild(btn_selinux);
}

function list_permissions() {
    box_submit.innerHTML = loading();
    cockpit.spawn(["/usr/share/cockpit/cockpit-selinux/scripts/get_name_permissions", "samba"])
        .stream((data) => check_permission_status(data));
}

async function check_permission_status(data1) {
    await cockpit.spawn(["/usr/share/cockpit/cockpit-selinux/scripts/check_permissions_status"])
        .stream((data2) => create_list(data1, data2));
}

function create_list(data1, data2) {
    permissions = Array.from(data1.split("\n")).filter((item) => item.length > 0);
    statusPermissions = Array.from(data2.split("\n")).filter((item) => item.length > 0);
    dados = statusPermissions;

    box_submit.innerHTML = "";
    select_permissions.innerHTML = "";

    var select = document.createElement('select');
    select.multiple = true
    select.id = "permissions_list";

    var option = document.createElement('option');
    option.value = "";
    option.text = "Selecione uma opção";
    option.disabled = true;
    select.appendChild(option);
    if (!statusPermissions.includes("on")) select.selectedIndex = 0;

    permissions.map((item, index) => {
        var option = document.createElement('option');
        option.value = item;
        option.text = item;
        option.selected = new String(statusPermissions[index]).toLowerCase() === "on" ? true : false;
        select.appendChild(option);
    });

    select_permissions.appendChild(select);

    var btn = document.createElement('button');
    btn.id = "btn_submit"
    btn.textContent = "Salvar";
    btn.classList.add("btn");
    btn.onclick = () => savePermissions();

    $('select').formSelect();
    box_submit.appendChild(btn);
}

async function savePermissions() {
    if(!enabled) {
        toast("SELinux desativado. Por favor, ative-o primeiro.", "error", 5000);
        list_permissions();
        return;
    }
    var list = Array.from(document.getElementById("permissions_list").children).slice(1);
    

    let modified = list.filter((item, index) => {
        let item1 = dados[index] === 'on' ? true : false;
        let item2 = list[index].selected;
        
        if(item1 !== item2) return item;
    });

    box_submit.innerHTML = loading();
    select_permissions.innerHTML = "";

    script = "";
    modified.map((item) => {
        var name = `${item.textContent}`;
        var value = `${item.selected ? 1 : 0}`;
        script += `setsebool -P ${name} ${value};`;
    });
    
    await cockpit.script(script).done(()=>toast("Permissões do samba alterada.", "success", 5000));

    list_permissions();
}

function done() {
    list_permissions();
}

function result(data) {
    console.log(data);
}

function loading() {
    return `
        <p class="vertical-margin-30">Isso pode levar alguns segundos...</p>
        <div class="preloader-wrapper big active centered">
            <div class="spinner-layer spinner-blue-only">
                <div class="circle-clipper left">
                <div class="circle"></div>
                </div><div class="gap-patch">
                <div class="circle"></div>
                </div><div class="circle-clipper right">
                <div class="circle"></div>
                </div>
            </div>
        </div>
    `;
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
    mdtoast(message, { type, duration });
}

init();
list_permissions();

cockpit.transport.wait(function () { });