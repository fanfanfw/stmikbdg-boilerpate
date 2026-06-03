import Swal from "sweetalert2"

const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
})

export const customSwal = {
    question: async ({
        title = 'Apakah anda yakin?',
        message = 'Anda akan mengubah atau menyimpan data tersebut',
        loadingTimer = 60000,
        callback = async () => {},
        onCancel = async () => {}
    }) => {
        Swal.fire({
            title,
            icon: 'question',
            text: message,
            showConfirmButton: true,
            showCancelButton: true,
            confirmButtonText: 'Ya',
            cancelButtonText: 'Tidak',
            customClass: {
                popup: `bg-white rounded-md border-2 border-zinc-700 text-xs sm:text-lg lg:text-xl font-jakarta tracking-tighter`,
                title: `text-zinc-600 text-sm sm:text-xl lg:text-2xl font-jakarta`,
                confirmButton: `bg-green-500 hover:bg-green-400 active:bg-green-700 text-white font-light px-3 py-2 rounded-md font-jakarta`,
                cancelButton: `px-3 py-2 font-light font-jakarta`
            }
        }).then(async (answer) => {
            if(answer.isConfirmed) {
                Swal.fire({
                    title: 'Harap Tunggu, ya!',
                    text: 'Kami sedang memproses data anda...',
                    timer: loadingTimer,
                    showConfirmButton: false,
                    timerProgressBar: true,
                    allowOutsideClick: false,
                    allowEscapeKey: false,
                    didOpen: callback(),
                    customClass: {
                        popup: `bg-white rounded-md border-2 border-zinc-700 text-xs sm:text-lg lg:text-xl font-jakarta tracking-tighter italic`,
                        title: `text-blue-500 text-sm sm:text-xl lg:text-2xl font-jakarta`,
                        timerProgressBar: 'bg-blue-500 text-blue-500'
                    }
                })
            }else{
                onCancel()
            }
        })
    },
    success: async ({
        title = "Sukses!",
        message = 'Berhasil mengubah atau menyimpan data tersebut',
        timer = 3000,
        callback = () => {},
        onFinish = () => {}
    }) => {
        Swal.fire({
            icon: 'success',
            title,
            text: message,
            timer,
            timerProgressBar: true,
            didOpen: callback(),
            showConfirmButton: false,
            customClass: {
                title: `text-green-600 font-semibold font-jakarta`,
                popup: `!bg-white !bg-white border-2 border-green-300 font-jakarta tracking-tighter`,
                timerProgressBar: 'text-green-500 bg-green-500'
            }
        }).then(() => {
            onFinish()
        })
    },
    error: async ({
        title = "Gagal!",
        message = 'Terdapat kesalahan dalam mengubah atau menyimpan data tersebut',
        timer = 3000,
        onFinish = async () => {}
    }) => {
        Swal.fire({
            icon: 'error',
            title,
            text: message,
            timer,
            timerProgressBar: true,
            customClass: {
                title: `text-red-600 font-semibold font-jakarta`,
                popup: `!bg-white !bg-white border-2 border-red-300 `,
                timerProgressBar: 'text-red-500 bg-red-500'
            }
        }).then(() => {
            onFinish()
        })
    },
    close: () => {
        Swal.close()
    },
    toast: {
        success: async ({
            title = 'Sukses!',
            message = 'Berhasil memproses data tersebut!',
            timer = 3000
        }) => {
            Toast.fire({
                icon: 'success',
                title,
                text: message,
                showConfirmButton: false,
                timerProgressBar: true,
                timer,
                customClass: {
                    title: `text-green-600 font-semibold font-jakarta`,
                    popup: `!bg-white !bg-white border-2 border-green-300 font-jakarta tracking-tighter`,
                    timerProgressBar: 'text-green-500 bg-green-500 border-green-500'
                }
            })
        },
        error: async ({
            title = 'Error!',
            message = 'Gagal memproses data tersebut!',
            timer = 3000
        }) => {
            Toast.fire({
                icon: 'error',
                title,
                text: message,
                showConfirmButton: false,
                timerProgressBar: true,
                timer,
                customClass: {
                    title: `text-red-600 font-semibold font-jakarta`,
                    popup: `!bg-white !bg-white border-2 border-red-300 font-jakarta tracking-tighter`,
                    timerProgressBar: 'text-red-500 bg-red-500'
                }
            })
        },
        warning: async ({
            title = 'Peringatan!',
            message = 'Data anda akan segera di proses',
            timer = 3000
        }) => {
            Toast.fire({
                icon: 'warning',
                title,
                text: message,
                showConfirmButton: false,
                timerProgressBar: true,
                timer
            })
        }
    },
    processing: async ({
        title = 'Harap Tunggu',
        message = 'Kami sedang memproses data anda...',
        timer = 60000,
        onProcess = async () => {}
    }) => {
        Swal.fire({
            title,
            text: message,
            timer,
            showConfirmButton: false,
            timerProgressBar: true,
            allowOutsideClick: false,
            allowEscapeKey: false,
            didOpen: onProcess(),
            customClass: {
                popup: `bg-white rounded-md border-2 border-zinc-700 text-xs sm:text-lg lg:text-xl font-jakarta tracking-tighter italic`,
                title: `text-blue-500 text-sm sm:text-xl lg:text-2xl font-jakarta`,
                timerProgressBar: 'bg-blue-500 text-blue-500'
            }
        })
    }
}
